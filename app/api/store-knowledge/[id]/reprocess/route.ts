import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import { generateCsReplyDecision } from "@/app/lib/csReplyGeneration";
import {
  findRelatedCsMessages,
  type PendingCsMessageRow,
} from "@/app/lib/missingInfoMatching";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  createStoreInfoEvidenceSnapshot,
  createUsedKnowledgeSnapshot,
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  mergeStoreKnowledgeIntoStore,
  mergeUsedKnowledgeSnapshots,
  selectRelevantStoreKnowledgeItems,
  warnMissingUsedKnowledgeColumn,
} from "@/app/lib/storeKnowledge";
import { resolveCsWorkflowStatus } from "@/app/lib/workflowStatus";

type StoreRow = CsReplyPromptStore & {
  id: number | string;
};

type StoreKnowledgeRow = {
  id: string;
  question: string;
  answer: string;
  source_text: string | null;
  status?: string | null;
};

function buildReferenceMessages(item: StoreKnowledgeRow) {
  return [
    item.question,
    item.answer,
    ...(item.source_text ?? "")
      .split(/\n+/)
      .map((line) => line.replace(/^(고객 문의|AI 기존 답변|사장님 수정 답변|출처 문의):\s*/u, "").trim()),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;

  if (!id) {
    return Response.json(
      { error: "Store knowledge id is required." },
      { status: 400 },
    );
  }

  const { data: knowledgeItem, error: knowledgeError } = await auth.supabase
    .from("store_knowledge_items")
    .select("id, question, answer, source_text, status")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (knowledgeError) {
    return Response.json(
      {
        error: "Failed to load store knowledge.",
        detail: knowledgeError.message,
      },
      { status: 500 },
    );
  }

  if (!knowledgeItem) {
    return Response.json(
      { error: "Store knowledge not found or not owned by current user." },
      { status: 404 },
    );
  }

  const knowledgeRow = knowledgeItem as StoreKnowledgeRow;

  if ((knowledgeRow.status ?? "active") !== "active") {
    return Response.json({
      success: true,
      matchedCsMessages: 0,
      updatedCsMessages: 0,
      message: "Active store knowledge only can reprocess related CS messages.",
    });
  }

  let { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(
      "id, user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, ai_work_mode, ai_work_start_time, ai_work_end_time, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    storeError &&
    /(ai_work_mode|ai_work_start_time|ai_work_end_time)/i.test(
      storeError.message,
    )
  ) {
    console.warn(
      "stores AI work mode columns are missing. Run: alter table stores add column if not exists ai_work_mode text default 'safe_auto'; alter table stores add column if not exists ai_work_start_time text default '09:00'; alter table stores add column if not exists ai_work_end_time text default '22:00';",
    );
    const fallback = await auth.supabase
      .from("stores")
      .select(
        "id, user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at",
      )
      .eq("user_id", auth.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    store = fallback.data
      ? {
          ...fallback.data,
          ai_work_mode: "safe_auto",
          ai_work_start_time: "09:00",
          ai_work_end_time: "22:00",
        }
      : null;
    storeError = fallback.error;
  }

  if (storeError) {
    return Response.json(
      { error: "Failed to load store.", detail: storeError.message },
      { status: 500 },
    );
  }

  if (!store) {
    return Response.json(
      { error: "No store found. Save store settings first." },
      { status: 404 },
    );
  }

  const { data: pendingCsMessages, error: pendingCsMessagesError } =
    await auth.supabase
      .from("cs_messages")
      .select("id, customer_message")
      .eq("user_id", auth.userId)
      .in("status", ["pending", "needs_review"]);

  if (pendingCsMessagesError) {
    return Response.json(
      {
        error: "Failed to load related CS messages.",
        detail: pendingCsMessagesError.message,
      },
      { status: 500 },
    );
  }

  const referenceMessages = buildReferenceMessages(knowledgeRow);
  const relatedCsMessages = findRelatedCsMessages(
    (pendingCsMessages ?? []) as PendingCsMessageRow[],
    referenceMessages,
  );

  console.info(
    `[store-knowledge/reprocess] Matched ${relatedCsMessages.length} related CS messages for storeKnowledgeId=${id}.`,
  );

  if (relatedCsMessages.length === 0) {
    return Response.json({
      success: true,
      matchedCsMessages: 0,
      updatedCsMessages: 0,
    });
  }

  const storeRow = store as StoreRow;
  const storeKnowledgeItems = await loadStoreKnowledgeItems({
    supabase: auth.supabase,
    userId: auth.userId,
  });

  let regeneratedReplies: {
    id: number | string;
    decision: Awaited<ReturnType<typeof generateCsReplyDecision>>;
    usedKnowledgeItems: ReturnType<typeof createUsedKnowledgeSnapshot>;
  }[];

  try {
    regeneratedReplies = await Promise.all(
      relatedCsMessages.map(async (message) => {
        const customerMessage = message.customer_message ?? "";
        const relevantStoreKnowledgeItems = selectRelevantStoreKnowledgeItems(
          customerMessage,
          storeKnowledgeItems,
        );
        const storeWithKnowledge = mergeStoreKnowledgeIntoStore(
          storeRow,
          relevantStoreKnowledgeItems,
        );
        const usedKnowledgeItems = mergeUsedKnowledgeSnapshots(
          createUsedKnowledgeSnapshot(relevantStoreKnowledgeItems),
          createStoreInfoEvidenceSnapshot(customerMessage, storeWithKnowledge),
        );

        return {
          id: message.id,
          decision: await generateCsReplyDecision({
            customerMessage,
            store: storeWithKnowledge,
          }),
          usedKnowledgeItems,
        };
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error: "Failed to regenerate related CS replies.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  for (const regeneratedReply of regeneratedReplies) {
    const status = resolveCsWorkflowStatus({
      autoCompleteLowRisk: storeRow.auto_complete_low_risk_cs,
      aiWorkMode: storeRow.ai_work_mode,
      aiWorkStartTime: storeRow.ai_work_start_time,
      aiWorkEndTime: storeRow.ai_work_end_time,
      handlingType: regeneratedReply.decision.handlingType,
      riskLevel: regeneratedReply.decision.riskLevel,
    });
    let { error: csMessageUpdateError } = await auth.supabase
      .from("cs_messages")
      .update({
        reply: regeneratedReply.decision.reply,
        status,
        handling_type: regeneratedReply.decision.handlingType,
        risk_level: regeneratedReply.decision.riskLevel,
        ai_reason: regeneratedReply.decision.aiReason,
        used_knowledge_items: regeneratedReply.usedKnowledgeItems,
      })
      .eq("id", regeneratedReply.id)
      .eq("user_id", auth.userId);

    if (isMissingUsedKnowledgeColumnError(csMessageUpdateError)) {
      warnMissingUsedKnowledgeColumn();
      const fallback = await auth.supabase
        .from("cs_messages")
        .update({
          reply: regeneratedReply.decision.reply,
          status,
          handling_type: regeneratedReply.decision.handlingType,
          risk_level: regeneratedReply.decision.riskLevel,
          ai_reason: regeneratedReply.decision.aiReason,
        })
        .eq("id", regeneratedReply.id)
        .eq("user_id", auth.userId);
      csMessageUpdateError = fallback.error;
    }

    if (isMissingAiReasonColumnError(csMessageUpdateError)) {
      warnMissingAiReasonColumns();
      const fallback = await auth.supabase
        .from("cs_messages")
        .update({
          reply: regeneratedReply.decision.reply,
          status,
          handling_type: regeneratedReply.decision.handlingType,
          risk_level: regeneratedReply.decision.riskLevel,
        })
        .eq("id", regeneratedReply.id)
        .eq("user_id", auth.userId);
      csMessageUpdateError = fallback.error;
    }

    if (csMessageUpdateError) {
      return Response.json(
        {
          error: "Failed to update related CS message.",
          detail: csMessageUpdateError.message,
        },
        { status: 500 },
      );
    }
  }

  return Response.json({
    success: true,
    matchedCsMessages: relatedCsMessages.length,
    updatedCsMessages: regeneratedReplies.length,
  });
}
