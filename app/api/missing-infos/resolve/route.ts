import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { generateCsReplyDecision } from "@/app/lib/csReplyGeneration";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

type RequestBody = {
  missingInfoId?: unknown;
  answer?: unknown;
  targetField?: unknown;
};

type TargetField =
  | "product_details"
  | "product_caution"
  | "shipping_policy"
  | "refund_policy"
  | "extra_faq";

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
  | "pricing"
  | "stock"
  | "business_hours"
  | "reservation"
  | "general";

type MissingInfoRow = {
  id: string;
  question: string | null;
  source_message: string | null;
  source_messages: unknown;
  topic: string | null;
};

type StoreRow = CsReplyPromptStore & {
  id: number | string;
};

type PendingCsMessageRow = {
  id: number | string;
  customer_message: string | null;
};

const allowedTargetFields: TargetField[] = [
  "product_details",
  "product_caution",
  "shipping_policy",
  "refund_policy",
  "extra_faq",
];

function isTargetField(value: string): value is TargetField {
  return allowedTargetFields.includes(value as TargetField);
}

function appendAdditionalInfo(currentValue: string | null, answer: string) {
  const trimmedCurrentValue = currentValue?.trim();

  return trimmedCurrentValue
    ? `${trimmedCurrentValue}\n추가 안내: ${answer}`
    : answer;
}

function classifyMissingInfoTopic(text: string): MissingInfoTopic {
  if (/제주|도서산간|배송비|추가 배송비/.test(text)) {
    return "shipping_fee";
  }

  if (/가격|얼마|몇\s*원/.test(text)) {
    return "pricing";
  }

  if (/재고|남은\s*수량|품절|매진/.test(text)) {
    return "stock";
  }

  if (/영업|운영\s*시간|오픈|마감/.test(text)) {
    return "business_hours";
  }

  if (/예약/.test(text)) {
    return "reservation";
  }

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

  if (/출고|배송일|언제 배송|발송/.test(text)) {
    return "shipping_schedule";
  }

  if (/환불|반품|교환/.test(text)) {
    return "refund_exchange";
  }

  return "general";
}

function getMissingInfoTopic(missingInfo: MissingInfoRow) {
  const existingTopic = missingInfo.topic?.trim();

  if (existingTopic) {
    return existingTopic as MissingInfoTopic;
  }

  return classifyMissingInfoTopic(
    `${missingInfo.question ?? ""}\n${missingInfo.source_message ?? ""}`,
  );
}

function normalizeSourceMessages(missingInfo: MissingInfoRow) {
  const messages = Array.isArray(missingInfo.source_messages)
    ? missingInfo.source_messages.filter(
        (message): message is string => typeof message === "string",
      )
    : [];

  if (
    missingInfo.source_message &&
    !messages.includes(missingInfo.source_message)
  ) {
    messages.unshift(missingInfo.source_message);
  }

  return messages;
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function getComparableTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function isSimilarMessage(candidate: string, references: string[]) {
  const normalizedCandidate = normalizeComparableText(candidate);
  const candidateTokens = getComparableTokens(candidate);

  return references.some((reference) => {
    const normalizedReference = normalizeComparableText(reference);

    if (
      normalizedCandidate === normalizedReference ||
      (Math.min(normalizedCandidate.length, normalizedReference.length) >= 8 &&
        (normalizedCandidate.includes(normalizedReference) ||
          normalizedReference.includes(normalizedCandidate)))
    ) {
      return true;
    }

    const referenceTokens = getComparableTokens(reference);
    const overlapCount = [...candidateTokens].filter((token) =>
      referenceTokens.has(token),
    ).length;

    return (
      overlapCount >= 2 ||
      (overlapCount === 1 &&
        Math.min(candidateTokens.size, referenceTokens.size) === 1)
    );
  });
}

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

  const relatedCsMessages = (
    (pendingCsMessages ?? []) as PendingCsMessageRow[]
  ).filter(
    (message) =>
      message.customer_message &&
      isSimilarMessage(message.customer_message, referenceMessages),
  );
  const updatedStoreRow = {
    ...storeRow,
    [targetField]: updatedTargetValue,
    updated_at: updatedAt,
  };
  let regeneratedReplies: {
    id: number | string;
    decision: Awaited<ReturnType<typeof generateCsReplyDecision>>;
  }[];

  try {
    regeneratedReplies = await Promise.all(
      relatedCsMessages.map(async (message) => ({
        id: message.id,
        decision: await generateCsReplyDecision({
          customerMessage: message.customer_message ?? "",
          store: updatedStoreRow,
        }),
      })),
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

  for (const regeneratedReply of regeneratedReplies) {
    let { error: csMessageUpdateError } = await auth.supabase
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

  return Response.json({
    success: true,
    updatedCsMessages: regeneratedReplies.length,
  });
}
