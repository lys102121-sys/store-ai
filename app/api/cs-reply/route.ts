import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import { buildCsReplySystemPrompt } from "@/app/lib/prompts/csReplyPrompt";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  customerMessage?: unknown;
};

type StoreRow = CsReplyPromptStore;

type HandlingType = "auto_ready" | "needs_review" | "needs_approval";
type RiskLevel = "low" | "normal" | "high";

type CsReplyDecision = {
  reply: string;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
};

type ExistingMissingInfoRow = {
  id: string;
  question: string | null;
  source_message: string | null;
  source_messages: unknown;
  inquiry_count: number | null;
};

type MissingInfoTopic =
  | "gift_wrapping"
  | "allergy"
  | "size_adjustment"
  | "care_instruction"
  | "material"
  | "product_composition"
  | "shipping_fee"
  | "shipping_schedule"
  | "refund_exchange"
  | "general";

const healthSafetyPattern =
  /알레르기|알러지|두드러기|발진|복통|식중독|상한\s*것\s*같|이상\s*반응|호흡|병원|아프다|아파|먹고\s*탈|탈났|피부\s*반응/;

function hasHealthSafetySignal(text: string) {
  return healthSafetyPattern.test(text);
}

function parseCsReplyDecision(output: string | undefined): CsReplyDecision | null {
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

    if (reply && handlingType && riskLevel) {
      return { reply, handlingType, riskLevel };
    }
  } catch {
    const reply = output.trim();
    if (reply) {
      return {
        reply,
        handlingType: "needs_approval",
        riskLevel: "normal",
      };
    }
  }

  return null;
}

function classifyMissingInfoTopic(text: string): MissingInfoTopic {
  if (/선물|포장|선물포장|포장되나요|포장 가능|기프트/.test(text)) {
    return "gift_wrapping";
  }

  if (/알레르기|알러지|피부|금속 알레르기/.test(text)) {
    return "allergy";
  }

  if (/사이즈|조절|크기|호수/.test(text)) {
    return "size_adjustment";
  }

  if (/물|땀|향수|변색|보관|세척/.test(text)) {
    return "care_instruction";
  }

  if (/재질|소재|실버|은|금속/.test(text)) {
    return "material";
  }

  if (/구성|용량|몇 인분|수량/.test(text)) {
    return "product_composition";
  }

  if (/제주|도서산간|배송비|추가 배송비/.test(text)) {
    return "shipping_fee";
  }

  if (/출고|배송일|언제 배송|발송/.test(text)) {
    return "shipping_schedule";
  }

  if (/환불|반품|교환/.test(text)) {
    return "refund_exchange";
  }

  return "general";
}

function hasMissingInfoSignal(reply: string) {
  return [
    "사장님 확인이 필요",
    "등록된 정보에 없어",
    "명시되어 있지 않습니다",
    "정확한 안내를 위해 확인",
    "확인 후 다시 말씀드리겠습니다",
    "확인 후 안내",
    "확인 후 안내드리겠습니다",
    "정확히 확인한 뒤",
    "사장님 확인이 필요합니다",
    "상품 정보가 명시되어 있지 않습니다",
    "상품 정보는 사장님 확인이 필요합니다",
    "해당 상품 정보는 사장님 확인이 필요합니다",
    "해당 내용은 사장님 확인이 필요합니다",
  ].some((signal) => reply.includes(signal));
}

function sanitizeCustomerReply(reply: string) {
  return reply
    .replaceAll(
      "현재 등록된 정보만으로는",
      "정확한 안내를 위해서는",
    )
    .replaceAll("현재 등록된 정보", "현재 확인 가능한 내용")
    .replaceAll("등록된 정보만으로는", "정확한 안내를 위해서는")
    .replaceAll(
      "상품 정보에 명시되어 있지 않습니다",
      "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다",
    )
    .replaceAll(
      "사장님 확인이 필요합니다",
      "확인 후 안내드리겠습니다",
    )
    .replaceAll("저장된 정보", "확인 가능한 내용")
    .replaceAll("시스템", "")
    .replaceAll("AI", "")
    .replaceAll("데이터", "내용")
    .replaceAll("DB", "");
}

function getRegisteredStoreText(store: StoreRow) {
  return [
    store.store_name,
    store.shipping_policy,
    store.refund_policy,
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

function isGiftWrapQuestion(message: string) {
  return /선물|포장|기프트/.test(message);
}

function hasGiftWrapInfo(store: StoreRow) {
  return /선물\s*포장|기프트|포장\s*(가능|불가|제공|지원)|포장.*(가능|불가|제공|지원)/.test(
    getRegisteredStoreText(store),
  );
}

function shouldSaveMissingInfo(
  reply: string,
  customerMessage: string,
  store: StoreRow,
) {
  return (
    hasMissingInfoSignal(reply) ||
    (isGiftWrapQuestion(customerMessage) && !hasGiftWrapInfo(store))
  );
}

function normalizeSourceMessages(
  sourceMessages: unknown,
  fallbackMessage: string | null,
) {
  const messages = Array.isArray(sourceMessages)
    ? sourceMessages.filter(
        (message): message is string => typeof message === "string",
      )
    : [];

  if (fallbackMessage && !messages.includes(fallbackMessage)) {
    messages.unshift(fallbackMessage);
  }

  return messages;
}

async function saveOrUpdateMissingInfo({
  supabase,
  userId,
  customerMessage,
  question,
  reason,
  topic,
}: {
  supabase: SupabaseClient;
  userId: string;
  customerMessage: string;
  question: string;
  reason: string;
  topic: MissingInfoTopic;
}) {
  let existingQuery = supabase
    .from("missing_infos")
    .select("id, question, source_message, source_messages, inquiry_count")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("topic", topic)
    .order("created_at", { ascending: false })
    .limit(1);

  if (topic === "general") {
    existingQuery = existingQuery.eq("question", question);
  }

  const { data: existingRows, error: existingError } = await existingQuery;

  if (existingError) {
    console.error("Failed to load existing missing info.", existingError);
    return;
  }

  const existingInfo = (existingRows?.[0] ??
    null) as ExistingMissingInfoRow | null;

  if (existingInfo) {
    const sourceMessages = normalizeSourceMessages(
      existingInfo.source_messages,
      existingInfo.source_message,
    );
    const nextSourceMessages = sourceMessages.includes(customerMessage)
      ? sourceMessages
      : [...sourceMessages, customerMessage];
    const nextInquiryCount = (existingInfo.inquiry_count ?? 1) + 1;

    const { error: updateError } = await supabase
      .from("missing_infos")
      .update({
        inquiry_count: nextInquiryCount,
        source_messages: nextSourceMessages,
        topic,
      })
      .eq("id", existingInfo.id)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update missing info.", updateError);
    }

    return;
  }

  const { error: insertError } = await supabase.from("missing_infos").insert({
    user_id: userId,
    question,
    reason,
    source_message: customerMessage,
    source_messages: [customerMessage],
    status: "pending",
    topic,
    inquiry_count: 1,
  });

  if (insertError) {
    console.error("Failed to save missing info.", insertError);
  }
}

function buildMissingInfo(customerMessage: string) {
  const normalizedMessage = customerMessage.replace(/\s+/g, " ").trim();

  if (isGiftWrapQuestion(normalizedMessage)) {
    return {
      question: "선물 포장 가능 여부를 알려주세요.",
      reason:
        "고객이 선물 포장 가능 여부를 문의했지만, 현재 등록된 상품 정보에 해당 내용이 없습니다.",
    };
  }

  if (/선물|포장|기프트/.test(normalizedMessage)) {
    return {
      question: "선물 포장 가능 여부를 알려주세요.",
      reason: "선물 포장 문의에 정확히 답변하려면 포장 가능 여부가 필요합니다.",
    };
  }

  if (/알러지|알레르기|알러르기|니켈|금속|주의/.test(normalizedMessage)) {
    return {
      question: "알레르기 관련 주의사항을 등록해주세요.",
      reason:
        "알레르기나 사용 주의사항은 고객 안전과 관련되어 정확한 상품 정보가 필요합니다.",
    };
  }

  if (/사이즈|크기|길이|폭|조절|치수/.test(normalizedMessage)) {
    return {
      question: "상품의 사이즈와 조절 가능 여부를 알려주세요.",
      reason: "상품 크기나 사이즈 조절 문의에 정확히 답변하려면 세부 정보가 필요합니다.",
    };
  }

  if (/재질|소재|성분|원단|도금/.test(normalizedMessage)) {
    return {
      question: "상품의 재질이나 소재 정보를 등록해주세요.",
      reason: "재질이나 소재 문의에 정확히 답변하려면 상품 세부 정보가 필요합니다.",
    };
  }

  if (/보관|사용법|세척|관리/.test(normalizedMessage)) {
    return {
      question: "상품의 보관방법이나 사용법을 등록해주세요.",
      reason: "보관방법이나 사용법 문의에 정확히 답변하려면 주의사항 정보가 필요합니다.",
    };
  }

  if (/배송|출고|도착|택배|제주|도서/.test(normalizedMessage)) {
    return {
      question: "배송 관련 세부 안내를 등록해주세요.",
      reason: "배송 문의에 정확히 답변하려면 배송 정책의 세부 정보가 필요합니다.",
    };
  }

  if (/환불|교환|반품|취소/.test(normalizedMessage)) {
    return {
      question: "환불, 교환, 반품 관련 세부 기준을 등록해주세요.",
      reason: "환불이나 교환 문의에 정확히 답변하려면 정책 기준이 필요합니다.",
    };
  }

  return {
    question: "고객 문의에 답변하기 위해 필요한 정보를 등록해주세요.",
    reason: "등록된 가게, 상품, 정책 정보만으로는 정확한 답변을 만들기 어렵습니다.",
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

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const customerMessage =
    typeof body.customerMessage === "string"
      ? body.customerMessage.trim()
      : "";

  if (!customerMessage) {
    return Response.json(
      {
        error: "'customerMessage' must be a non-empty string.",
      },
      { status: 400 },
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
      {
        error:
          "No store found. Save store settings first, then try again.",
      },
      { status: 404 },
    );
  }

  const storeRow = store as StoreRow;
  const systemPrompt = buildCsReplySystemPrompt(storeRow);

  try {
    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `고객 문의:\n${customerMessage}\n\n저장된 CS 응대 예시가 있으면 그 말투를 우선 따르고, 없으면 친절하고 자연스럽게 답변하세요.`,
            },
          ],
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
    const hasHealthSafetyIssue = hasHealthSafetySignal(customerMessage);
    const decision = parsedDecision
      ? {
          ...parsedDecision,
          handlingType: hasHealthSafetyIssue
            ? ("needs_approval" as const)
            : parsedDecision.handlingType,
          riskLevel: hasHealthSafetyIssue
            ? ("high" as const)
            : parsedDecision.riskLevel,
        }
      : null;
    const reply = decision
      ? sanitizeCustomerReply(decision.reply).trim()
      : "";

    if (!decision || !reply) {
      return Response.json(
        { error: "Failed to generate a CS reply." },
        { status: 502 },
      );
    }

    const shouldCreateMissingInfo = shouldSaveMissingInfo(
      reply,
      customerMessage,
      storeRow,
    );
    const status =
      storeRow.auto_complete_low_risk_cs &&
      decision.handlingType === "auto_ready" &&
      decision.riskLevel === "low" &&
      !shouldCreateMissingInfo
        ? "completed"
        : decision.handlingType === "needs_review" || shouldCreateMissingInfo
          ? "needs_review"
          : "pending";

    let { error: csMessageSaveError } = await auth.supabase
      .from("cs_messages")
      .insert({
        user_id: auth.userId,
        customer_message: customerMessage,
        reply,
        status,
        handling_type: decision.handlingType,
        risk_level: decision.riskLevel,
        source_platform: "manual",
        external_id: null,
        external_url: null,
        platform_status: "local",
      });

    if (
      csMessageSaveError &&
      /(source_platform|external_id|external_url|platform_status)/i.test(
        csMessageSaveError.message,
      )
    ) {
      console.warn(
        "cs_messages platform columns are missing. Run: alter table cs_messages add column if not exists source_platform text default 'manual'; alter table cs_messages add column if not exists external_id text; alter table cs_messages add column if not exists external_url text; alter table cs_messages add column if not exists platform_status text default 'local';",
      );
      const fallback = await auth.supabase.from("cs_messages").insert({
        user_id: auth.userId,
        customer_message: customerMessage,
        reply,
        status,
        handling_type: decision.handlingType,
        risk_level: decision.riskLevel,
      });

      csMessageSaveError = fallback.error;
    }

    if (
      csMessageSaveError &&
      /(handling_type|risk_level)/i.test(csMessageSaveError.message)
    ) {
      console.warn(
        "cs_messages handling columns are missing. Run: alter table cs_messages add column if not exists handling_type text default 'needs_approval'; alter table cs_messages add column if not exists risk_level text default 'normal';",
      );
      const fallback = await auth.supabase.from("cs_messages").insert({
        user_id: auth.userId,
        customer_message: customerMessage,
        reply,
        status,
      });

      csMessageSaveError = fallback.error;
    }

    if (csMessageSaveError && /status/i.test(csMessageSaveError.message)) {
      const fallback = await auth.supabase.from("cs_messages").insert({
        user_id: auth.userId,
        customer_message: customerMessage,
        reply,
      });

      csMessageSaveError = fallback.error;
    }

    if (csMessageSaveError) {
      console.error("Failed to save CS message.", csMessageSaveError);
    }

    if (shouldCreateMissingInfo) {
      const missingInfo = buildMissingInfo(customerMessage);
      const topic = classifyMissingInfoTopic(
        `${customerMessage}\n${missingInfo.question}`,
      );

      await saveOrUpdateMissingInfo({
        supabase: auth.supabase,
        userId: auth.userId,
        customerMessage,
        question: missingInfo.question,
        reason: missingInfo.reason,
        topic,
      });
    }

    return Response.json({
      reply,
      status,
      handling_type: decision.handlingType,
      risk_level: decision.riskLevel,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI API error.";

    return Response.json(
      { error: "Failed to call OpenAI API.", detail: message },
      { status: 500 },
    );
  }
}
