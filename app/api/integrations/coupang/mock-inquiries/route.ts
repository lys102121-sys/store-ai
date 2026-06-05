import OpenAI from "openai";

import { buildCsAiReason } from "@/app/lib/aiDecisionReason";
import {
  isMissingAiReasonColumnError,
  withoutAiReason,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  applyOperationalInfoGuard,
  findMissingOperationalInfo,
} from "@/app/lib/csOperationalInfo";
import { buildCsReplySystemPrompt } from "@/app/lib/prompts/csReplyPrompt";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import { hasHealthSafetySignal } from "@/app/lib/riskSignals";
import {
  createUsedKnowledgeSnapshot,
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  mergeStoreKnowledgeIntoStore,
  selectRelevantStoreKnowledgeItems,
  warnMissingUsedKnowledgeColumn,
  withoutUsedKnowledgeItems,
} from "@/app/lib/storeKnowledge";
import { resolveCsWorkflowStatus } from "@/app/lib/workflowStatus";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const mockInquiries = [
  "이 상품 오늘 출고되나요?",
  "선물 포장 가능한가요?",
  "상품을 사용하고 피부가 가려워졌어요. 알레르기일까요?",
] as const;

type HandlingType = "auto_ready" | "needs_review" | "needs_approval";
type RiskLevel = "low" | "normal" | "high";

type CsReplyDecision = {
  reply: string;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
};

function parseCsReplyDecision(
  output: string | undefined,
): CsReplyDecision | null {
  if (!output) return null;

  try {
    const parsed = JSON.parse(output) as {
      reply?: unknown;
      handling_type?: unknown;
      risk_level?: unknown;
    };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const handlingType =
      parsed.handling_type === "auto_ready" ||
      parsed.handling_type === "needs_review" ||
      parsed.handling_type === "needs_approval"
        ? parsed.handling_type
        : null;
    const riskLevel =
      parsed.risk_level === "low" ||
      parsed.risk_level === "normal" ||
      parsed.risk_level === "high"
        ? parsed.risk_level
        : null;

    return reply && handlingType && riskLevel
      ? { reply, handlingType, riskLevel }
      : null;
  } catch {
    return null;
  }
}

function sanitizeCustomerReply(reply: string) {
  return reply
    .replaceAll("등록된 정보", "확인 가능한 내용")
    .replaceAll("사장님 확인", "확인")
    .replaceAll("데이터", "내용")
    .replaceAll("AI", "")
    .trim();
}

function getStoreText(store: CsReplyPromptStore) {
  return [
    store.shipping_policy,
    store.product_name,
    store.product_description,
    store.product_details,
    store.product_caution,
    store.product_catalog,
    store.extra_faq,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}

function needsStoreConfirmation(
  customerMessage: string,
  store: CsReplyPromptStore,
) {
  if (/선물|포장|기프트/.test(customerMessage)) {
    return !/선물\s*포장|기프트\s*포장|포장.*(가능|불가|제공|지원)/.test(
      getStoreText(store),
    );
  }

  if (/출고|배송|발송/.test(customerMessage)) {
    return !store.shipping_policy?.trim();
  }

  return false;
}

async function generateMockReply(
  customerMessage: string,
  store: CsReplyPromptStore,
) {
  const completion = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: buildCsReplySystemPrompt(store),
      },
      {
        role: "user",
        content: `고객 문의:\n${customerMessage}\n\n저장된 CS 응대 예시가 있으면 그 말투를 우선 따르고, 없으면 친절하고 자연스럽게 답변하세요.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cs_reply_decision",
        schema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            handling_type: {
              type: "string",
              enum: ["auto_ready", "needs_review", "needs_approval"],
            },
            risk_level: {
              type: "string",
              enum: ["low", "normal", "high"],
            },
          },
          required: ["reply", "handling_type", "risk_level"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  const parsedDecision = parseCsReplyDecision(completion.output_text?.trim());
  if (!parsedDecision) {
    throw new Error("Failed to generate a mock CS reply.");
  }

  const hasHealthSafetyIssue = hasHealthSafetySignal(customerMessage);
  const needsReview = needsStoreConfirmation(customerMessage, store);
  const initialDecision: CsReplyDecision = {
    reply: sanitizeCustomerReply(parsedDecision.reply),
    handlingType: hasHealthSafetyIssue
      ? "needs_approval"
      : needsReview
        ? "needs_review"
        : parsedDecision.handlingType,
    riskLevel: hasHealthSafetyIssue ? "high" : parsedDecision.riskLevel,
  };
  const decision =
    (!hasHealthSafetyIssue &&
      applyOperationalInfoGuard({
        customerMessage,
        reply: initialDecision.reply,
        store,
      })) ||
    initialDecision;

  if (!decision.reply) {
    throw new Error("Failed to generate a mock CS reply.");
  }

  return {
    ...decision,
    aiReason: buildCsAiReason({
      customerMessage,
      handlingType: decision.handlingType,
      riskLevel: decision.riskLevel,
      missingOperationalInfo: findMissingOperationalInfo(customerMessage, store),
    }),
  };
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(
      "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeError) {
    return Response.json(
      { error: "Failed to load store.", detail: storeError.message },
      { status: 500 },
    );
  }

  if (!store) {
    return Response.json(
      { error: "No store found. Save store settings first, then try again." },
      { status: 404 },
    );
  }

  try {
    const baseStoreRow = store as CsReplyPromptStore;
    const storeKnowledgeItems = await loadStoreKnowledgeItems({
      supabase: auth.supabase,
      userId: auth.userId,
    });
    const decisions = await Promise.all(
      mockInquiries.map((inquiry) => {
        const relevantStoreKnowledgeItems = selectRelevantStoreKnowledgeItems(
          inquiry,
          storeKnowledgeItems,
        );

        return generateMockReply(
          inquiry,
          mergeStoreKnowledgeIntoStore(baseStoreRow, relevantStoreKnowledgeItems),
        );
      }),
    );
    const timestamp = Date.now();
    const rows = decisions.map((decision, index) => {
      const customerMessage = mockInquiries[index];
      const relevantStoreKnowledgeItems = selectRelevantStoreKnowledgeItems(
        customerMessage,
        storeKnowledgeItems,
      );
      const usedKnowledgeItems = createUsedKnowledgeSnapshot(
        relevantStoreKnowledgeItems,
      );
      const status = resolveCsWorkflowStatus({
        autoCompleteLowRisk: baseStoreRow.auto_complete_low_risk_cs,
        handlingType: decision.handlingType,
        riskLevel: decision.riskLevel,
      });

      return {
        user_id: auth.userId,
        customer_message: customerMessage,
        reply: decision.reply,
        status,
        handling_type: decision.handlingType,
        risk_level: decision.riskLevel,
        ai_reason: decision.aiReason,
        used_knowledge_items: usedKnowledgeItems,
        source_platform: "coupang",
        external_id: `mock-coupang-${timestamp}-${index + 1}`,
        external_url: null,
        platform_status: "synced",
      };
    });

    let { error: insertError } = await auth.supabase
      .from("cs_messages")
      .insert(rows);

    if (isMissingUsedKnowledgeColumnError(insertError)) {
      warnMissingUsedKnowledgeColumn();
      const fallbackRows = rows.map(withoutUsedKnowledgeItems);
      const fallback = await auth.supabase
        .from("cs_messages")
        .insert(fallbackRows);
      insertError = fallback.error;
    }

    if (isMissingAiReasonColumnError(insertError)) {
      warnMissingAiReasonColumns();
      const fallbackRows = rows
        .map(withoutUsedKnowledgeItems)
        .map(withoutAiReason);
      const fallback = await auth.supabase
        .from("cs_messages")
        .insert(fallbackRows);
      insertError = fallback.error;
    }

    if (insertError) {
      return Response.json(
        { error: "Failed to save mock Coupang inquiries.", detail: insertError.message },
        { status: 500 },
      );
    }

    return Response.json({
      inserted: rows.length,
      message: "쿠팡 샘플 문의가 AI CS 처리함에 추가되었습니다.",
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to generate mock Coupang inquiries.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
