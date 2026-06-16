import { requireAuthenticatedUser } from "@/app/lib/auth";
import { recordAiActivityLog } from "@/app/lib/aiActivityLog";
import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { generateCsReplyDecision } from "@/app/lib/csReplyGeneration";
import {
  buildCsReplyCorrectionPrompt,
  loadCsReplyCorrections,
} from "@/app/lib/csReplyCorrectionLearning";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  createStoreInfoEvidenceSnapshot,
  createUsedKnowledgeSnapshot,
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  mapMissingInfoTopicToKnowledgeCategory,
  mergeUsedKnowledgeSnapshots,
  mergeStoreKnowledgeIntoStore,
  saveStoreKnowledgeItem,
  selectRelevantStoreKnowledgeItems,
  type StoreKnowledgeItem,
  warnMissingUsedKnowledgeColumn,
} from "@/app/lib/storeKnowledge";
import {
  appendAdditionalInfo,
  findRelatedCsMessages,
  getMissingInfoTopic,
  isTargetField,
  normalizeSourceMessages,
  type MissingInfoRow,
  type PendingCsMessageRow,
} from "@/app/lib/missingInfoMatching";

type RequestBody = {
  missingInfoId?: unknown;
  answer?: unknown;
  targetField?: unknown;
};

type StoreRow = CsReplyPromptStore & {
  id: number | string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
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

  const missingInfoId =
    typeof body.missingInfoId === "string" ? body.missingInfoId.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const targetField =
    typeof body.targetField === "string" ? body.targetField.trim() : "";

  if (!missingInfoId || !answer) {
    return Response.json(
      { error: "missingInfoId and answer must be non-empty strings." },
      { status: 400 },
    );
  }

  if (!isTargetField(targetField)) {
    return Response.json(
      { error: "targetField is not allowed." },
      { status: 400 },
    );
  }

  const { data: missingInfo, error: missingInfoError } = await auth.supabase
    .from("missing_infos")
    .select("id, question, source_message, source_messages, topic")
    .eq("id", missingInfoId)
    .eq("user_id", auth.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (missingInfoError) {
    return Response.json(
      {
        error: "Failed to load missing info.",
        detail: missingInfoError.message,
      },
      { status: 500 },
    );
  }

  if (!missingInfo) {
    return Response.json(
      { error: "Pending missing info was not found." },
      { status: 404 },
    );
  }

  const missingInfoRow = missingInfo as MissingInfoRow;
  const resolvedTopic = getMissingInfoTopic(missingInfoRow);

  if (!missingInfoRow.topic?.trim()) {
    const { error: topicUpdateError } = await auth.supabase
      .from("missing_infos")
      .update({ topic: resolvedTopic })
      .eq("id", missingInfoId)
      .eq("user_id", auth.userId);

    if (topicUpdateError) {
      return Response.json(
        {
          error: "Failed to update missing info topic.",
          detail: topicUpdateError.message,
        },
        { status: 500 },
      );
    }
  }

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(
      "id, user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at",
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
      { error: "No store found. Save store settings first." },
      { status: 404 },
    );
  }

  const storeRow = store as StoreRow;
  const updatedAt = new Date().toISOString();
  const updatedTargetValue = appendAdditionalInfo(
    storeRow[targetField],
    answer,
  );
  const storeUpdate = {
    [targetField]: updatedTargetValue,
    updated_at: updatedAt,
  };
  let resolvedIds = [missingInfoId];
  let relatedInfos = [missingInfoRow];

  if (resolvedTopic !== "general") {
    const { data: pendingInfos, error: pendingInfosError } = await auth.supabase
      .from("missing_infos")
      .select("id, question, source_message, source_messages, topic")
      .eq("user_id", auth.userId)
      .eq("status", "pending");

    if (pendingInfosError) {
      return Response.json(
        {
          error: "Failed to load related missing infos.",
          detail: pendingInfosError.message,
        },
        { status: 500 },
      );
    }

    relatedInfos = ((pendingInfos ?? []) as MissingInfoRow[]).filter(
      (info) => getMissingInfoTopic(info) === resolvedTopic,
    );

    resolvedIds = relatedInfos.map((info) => info.id);

    const infosWithoutTopic = relatedInfos.filter((info) => !info.topic?.trim());

    await Promise.all(
      infosWithoutTopic.map((info) =>
        auth.supabase
          .from("missing_infos")
          .update({ topic: resolvedTopic })
          .eq("id", info.id)
          .eq("user_id", auth.userId),
      ),
    );
  }

  const referenceMessages = [
    missingInfoRow.question ?? "",
    ...relatedInfos.flatMap(normalizeSourceMessages),
  ].filter(Boolean);
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

  const relatedCsMessages = findRelatedCsMessages(
    (pendingCsMessages ?? []) as PendingCsMessageRow[],
    referenceMessages,
  );

  console.info(
    `[missing-infos/resolve] Matched ${relatedCsMessages.length} related CS messages for missingInfoId=${missingInfoId}, topic=${resolvedTopic}.`,
  );

  const updatedStoreRow = {
    ...storeRow,
    [targetField]: updatedTargetValue,
    updated_at: updatedAt,
  };
  const learnedKnowledgeItem: StoreKnowledgeItem = {
    id: `missing-info-${missingInfoId}`,
    user_id: auth.userId,
    store_id: String(storeRow.id),
    category: mapMissingInfoTopicToKnowledgeCategory(resolvedTopic),
    question: missingInfoRow.question ?? "고객 문의에 필요한 정보",
    answer,
    source_type: "missing_info",
    source_id: missingInfoId,
    source_text: referenceMessages[0] ?? missingInfoRow.source_message,
    confidence: "owner_confirmed",
    created_at: updatedAt,
    updated_at: updatedAt,
  };
  const storeKnowledgeItems = [
    learnedKnowledgeItem,
    ...(await loadStoreKnowledgeItems({
      supabase: auth.supabase,
      userId: auth.userId,
    })),
  ];
  const uniqueStoreKnowledgeItems = [
    ...new Map(
      storeKnowledgeItems.map((item) => [
        `${item.category}:${item.question}`,
        item,
      ]),
    ).values(),
  ];
  const replyCorrections = await loadCsReplyCorrections({
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
          uniqueStoreKnowledgeItems,
        );
        const storeWithKnowledge = mergeStoreKnowledgeIntoStore(
          updatedStoreRow,
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
            correctionContext: buildCsReplyCorrectionPrompt(
              customerMessage,
              replyCorrections,
            ),
            replyCorrections,
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
  const { error: storeUpdateError } = await auth.supabase
    .from("stores")
    .update(storeUpdate)
    .eq("id", storeRow.id)
    .eq("user_id", auth.userId);

  if (storeUpdateError) {
    return Response.json(
      { error: "Failed to update store.", detail: storeUpdateError.message },
      { status: 500 },
    );
  }

  await saveStoreKnowledgeItem({
    supabase: auth.supabase,
    userId: auth.userId,
    storeId: storeRow.id,
    category: mapMissingInfoTopicToKnowledgeCategory(resolvedTopic),
    question: missingInfoRow.question ?? "고객 문의에 필요한 정보",
    answer,
    sourceId: missingInfoId,
    sourceText: referenceMessages[0] ?? missingInfoRow.source_message,
  });

  for (const regeneratedReply of regeneratedReplies) {
    let { error: csMessageUpdateError } = await auth.supabase
      .from("cs_messages")
      .update({
        reply: regeneratedReply.decision.reply,
        status: "pending",
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
          status: "pending",
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
          status: "pending",
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

  const { error: missingInfoUpdateError } = await auth.supabase
    .from("missing_infos")
    .update({ status: "resolved", topic: resolvedTopic })
    .eq("user_id", auth.userId)
    .eq("status", "pending")
    .in("id", resolvedIds);

  if (missingInfoUpdateError) {
    return Response.json(
      {
        error: "Failed to resolve missing info.",
        detail: missingInfoUpdateError.message,
      },
      { status: 500 },
    );
  }

  await recordAiActivityLog(auth.supabase, {
    userId: auth.userId,
    eventType: "missing_info_resolved",
    title: "확인 필요 정보를 학습했습니다",
    description: `사장님 답변을 가게 지식에 저장하고 관련 문의 ${regeneratedReplies.length}건에 반영했습니다.`,
    relatedType: "missing_info",
    relatedId: missingInfoId,
    status: "resolved",
    sourcePlatform: "manual",
    metadata: {
      topic: resolvedTopic,
      targetField,
      resolvedMissingInfoCount: resolvedIds.length,
      updatedCsMessages: regeneratedReplies.length,
      question: missingInfoRow.question,
    },
  });

  return Response.json({
    success: true,
    updatedCsMessages: regeneratedReplies.length,
  });
}
