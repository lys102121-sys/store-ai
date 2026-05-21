import { requireAuthenticatedUser } from "@/app/lib/auth";

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
  | "general";

type MissingInfoRow = {
  id: string;
  question: string | null;
  source_message: string | null;
  topic: string | null;
};

type StoreRow = {
  id: number | string;
  product_details: string | null;
  product_caution: string | null;
  shipping_policy: string | null;
  refund_policy: string | null;
  extra_faq: string | null;
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

function getMissingInfoTopic(missingInfo: MissingInfoRow) {
  const existingTopic = missingInfo.topic?.trim();

  if (existingTopic) {
    return existingTopic as MissingInfoTopic;
  }

  return classifyMissingInfoTopic(
    `${missingInfo.question ?? ""}\n${missingInfo.source_message ?? ""}`,
  );
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
    .select("id, question, source_message, topic")
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
      "id, product_details, product_caution, shipping_policy, refund_policy, extra_faq",
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
  const storeUpdate = {
    [targetField]: appendAdditionalInfo(storeRow[targetField], answer),
    updated_at: updatedAt,
  };

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

  let resolvedIds = [missingInfoId];

  if (resolvedTopic !== "general") {
    const { data: pendingInfos, error: pendingInfosError } = await auth.supabase
      .from("missing_infos")
      .select("id, question, source_message, topic")
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

    const relatedInfos = ((pendingInfos ?? []) as MissingInfoRow[]).filter(
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

  return Response.json({ success: true });
}
