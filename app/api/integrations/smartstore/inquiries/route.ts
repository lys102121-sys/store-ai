import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAiActivityLog } from "@/app/lib/aiActivityLog";
import {
  isMissingAiReasonColumnError,
  withoutAiReason,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import { getBillingPlanStatus } from "@/app/lib/billingPlan";
import { findMissingOperationalInfo } from "@/app/lib/csOperationalInfo";
import { loadCsReplyCorrections } from "@/app/lib/csReplyCorrectionLearning";
import {
  createNormalizedPlatformInquiry,
  type NormalizedPlatformInquiry,
} from "@/app/lib/platformInquiry";
import { preparePlatformInquiryForStorage } from "@/app/lib/platformInquiryProcessing";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  warnMissingUsedKnowledgeColumn,
  withoutUsedKnowledgeItems,
} from "@/app/lib/storeKnowledge";

export const runtime = "nodejs";

type SmartstoreCredential = {
  vendor_id: string | null;
  access_key: string | null;
  secret_key: string | null;
  wing_id: string | null;
};

type SmartstoreInquiryFetchResult =
  | {
      status: "not_implemented";
      inquiries: NormalizedPlatformInquiry[];
    }
  | {
      status: "ready";
      inquiries: NormalizedPlatformInquiry[];
    };

const smartstoreStoreSelect =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, ai_work_mode, ai_work_start_time, ai_work_end_time, created_at, updated_at";
const legacySmartstoreStoreSelect =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at";

function textFromRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function nestedTextFromRecord(
  record: Record<string, unknown>,
  key: string,
  nestedKeys: string[],
) {
  const nested = record[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return "";
  }

  return textFromRecord(nested as Record<string, unknown>, nestedKeys);
}

function findArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["data", "contents", "content", "items", "inquiries"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

export function parseSmartstoreInquiries(
  payload: unknown,
): NormalizedPlatformInquiry[] {
  return findArrayPayload(payload).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const record = item as Record<string, unknown>;
    const externalId = textFromRecord(record, [
      "inquiryId",
      "questionId",
      "inquiryNo",
      "productInquiryNo",
      "id",
    ]);
    const content = textFromRecord(record, [
      "content",
      "question",
      "inquiryContent",
      "inquiry",
      "title",
    ]);

    if (!externalId || !content) return [];

    return [
      createNormalizedPlatformInquiry({
        sourcePlatform: "smartstore",
        externalId,
        content,
        productName:
          textFromRecord(record, [
            "productName",
            "productTitle",
            "channelProductName",
            "itemName",
          ]) ||
          nestedTextFromRecord(record, "product", ["name", "title"]) ||
          null,
        createdAt:
          textFromRecord(record, [
            "createdAt",
            "createdDate",
            "inquiryAt",
            "registeredAt",
          ]) || null,
        externalUrl:
          textFromRecord(record, ["externalUrl", "url", "inquiryUrl"]) || null,
      }),
    ];
  });
}

async function fetchSmartstoreInquiries(
  credential: Required<SmartstoreCredential>,
): Promise<SmartstoreInquiryFetchResult> {
  void credential;
  // TODO: 스마트스토어 문서 확인 후 실제 상품 문의 조회 endpoint, 인증 헤더,
  // query parameter를 연결한다. 지금 단계에서는 실제 API를 호출하지 않는다.
  return {
    status: "not_implemented",
    inquiries: [],
  };
}

function buildMissingInfo(
  inquiry: NormalizedPlatformInquiry,
  store: CsReplyPromptStore,
) {
  const missingOperationalInfo = findMissingOperationalInfo(
    inquiry.content,
    store,
  );
  if (missingOperationalInfo) {
    return {
      question: missingOperationalInfo.question,
      reason: missingOperationalInfo.reason,
      topic: missingOperationalInfo.topic,
    };
  }

  const productName = inquiry.productName ? ` '${inquiry.productName}'` : "";

  return {
    question: `${productName} 상품 문의에 답변하기 위해 필요한 정보를 등록해 주세요.`.trim(),
    reason:
      "스마트스토어에서 가져온 문의에 정확히 답변하려면 상품 또는 정책 정보를 추가로 확인해야 합니다.",
    topic: "general",
  };
}

async function saveMissingInfo({
  supabase,
  userId,
  inquiry,
  store,
}: {
  supabase: SupabaseClient;
  userId: string;
  inquiry: NormalizedPlatformInquiry;
  store: CsReplyPromptStore;
}) {
  const missingInfo = buildMissingInfo(inquiry, store);
  const { data: existingRows, error: existingError } = await supabase
    .from("missing_infos")
    .select("id, source_message, source_messages, inquiry_count")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("topic", missingInfo.topic)
    .eq("question", missingInfo.question)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingError) {
    console.error("Failed to load existing missing info.", existingError);
    return;
  }

  const existing = existingRows?.[0];
  if (existing) {
    const sourceMessages = Array.isArray(existing.source_messages)
      ? existing.source_messages.filter(
          (message): message is string => typeof message === "string",
        )
      : [];
    if (
      typeof existing.source_message === "string" &&
      !sourceMessages.includes(existing.source_message)
    ) {
      sourceMessages.unshift(existing.source_message);
    }
    if (!sourceMessages.includes(inquiry.content)) {
      sourceMessages.push(inquiry.content);
    }

    const { error } = await supabase
      .from("missing_infos")
      .update({
        source_messages: sourceMessages,
        inquiry_count: (existing.inquiry_count ?? 1) + 1,
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to update missing info.", error);
    }
    return;
  }

  const { error } = await supabase.from("missing_infos").insert({
    user_id: userId,
    question: missingInfo.question,
    reason: missingInfo.reason,
    source_message: inquiry.content,
    source_messages: [inquiry.content],
    status: "pending",
    topic: missingInfo.topic,
    inquiry_count: 1,
  });

  if (error) {
    console.error("Failed to save missing info.", error);
  }
}

async function loadStoreForSmartstoreImport(
  supabase: SupabaseClient,
  userId: string,
) {
  let { data: store, error: storeError } = await supabase
    .from("stores")
    .select(smartstoreStoreSelect)
    .eq("user_id", userId)
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
    const fallback = await supabase
      .from("stores")
      .select(legacySmartstoreStoreSelect)
      .eq("user_id", userId)
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

  return { store, storeError };
}

async function updateCredentialStatus(
  supabase: SupabaseClient,
  userId: string,
  status: "connected" | "error",
) {
  const updatedAt = new Date().toISOString();
  await supabase
    .from("platform_credentials")
    .update({
      status,
      last_tested_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq("user_id", userId)
    .eq("platform", "smartstore");
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const plan = await getBillingPlanStatus({
    supabase: auth.supabase,
    userId: auth.userId,
  });

  if (!plan.isPaid) {
    return Response.json(
      {
        error:
          "스마트스토어 실제 문의 가져오기는 유료 플랜에서 사용할 수 있습니다. 샘플 문의로 먼저 흐름을 테스트해 주세요.",
        paid_plan_required: true,
      },
      { status: 402 },
    );
  }

  const { data: credential, error: credentialError } = await auth.supabase
    .from("platform_credentials")
    .select("vendor_id, access_key, secret_key, wing_id")
    .eq("user_id", auth.userId)
    .eq("platform", "smartstore")
    .maybeSingle();

  if (credentialError) {
    return Response.json(
      {
        error: "Failed to read Smartstore credentials.",
        detail: credentialError.message,
      },
      { status: 500 },
    );
  }

  const vendorId = credential?.vendor_id?.trim();
  const accessKey = credential?.access_key?.trim();
  const secretKey = credential?.secret_key?.trim();
  const wingId = credential?.wing_id?.trim();

  if (!vendorId || !accessKey || !secretKey) {
    return Response.json(
      { error: "Smartstore credentials are incomplete." },
      { status: 400 },
    );
  }

  const { store, storeError } = await loadStoreForSmartstoreImport(
    auth.supabase,
    auth.userId,
  );

  if (storeError) {
    return Response.json(
      { error: "Failed to load store.", detail: storeError.message },
      { status: 500 },
    );
  }

  if (!store) {
    return Response.json(
      { error: "No store found. Save store settings first, then try again." },
      { status: 400 },
    );
  }

  const fetchResult = await fetchSmartstoreInquiries({
    vendor_id: vendorId,
    access_key: accessKey,
    secret_key: secretKey,
    wing_id: wingId ?? "",
  });

  if (fetchResult.status === "not_implemented") {
    return Response.json(
      {
        error:
          "스마트스토어 문의 가져오기 기능은 다음 단계에서 실제 API와 연결될 예정입니다.",
        not_implemented: true,
      },
      { status: 501 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const uniqueInquiries = [
    ...new Map(
      fetchResult.inquiries.map((item) => [item.externalId, item]),
    ).values(),
  ];
  const externalIds = uniqueInquiries.map((item) => item.externalId);
  let existingExternalIds = new Set<string>();

  if (externalIds.length > 0) {
    const { data: existingRows, error: existingError } = await auth.supabase
      .from("cs_messages")
      .select("external_id")
      .eq("user_id", auth.userId)
      .eq("source_platform", "smartstore")
      .in("external_id", externalIds);

    if (existingError) {
      return Response.json(
        {
          error: "Failed to check existing Smartstore inquiries.",
          detail: existingError.message,
        },
        { status: 500 },
      );
    }

    existingExternalIds = new Set(
      (existingRows ?? []).flatMap((row) =>
        typeof row.external_id === "string" ? [row.external_id] : [],
      ),
    );
  }

  const newInquiries = uniqueInquiries.filter(
    (item) => !existingExternalIds.has(item.externalId),
  );
  const baseStoreRow = store as CsReplyPromptStore;
  const [storeKnowledgeItems, replyCorrections] = await Promise.all([
    loadStoreKnowledgeItems({
      supabase: auth.supabase,
      userId: auth.userId,
    }),
    loadCsReplyCorrections({
      supabase: auth.supabase,
      userId: auth.userId,
    }),
  ]);
  const preparedInquiries = [];

  for (const inquiry of newInquiries) {
    const preparedInquiry = await preparePlatformInquiryForStorage({
      userId: auth.userId,
      inquiry,
      baseStore: baseStoreRow,
      storeKnowledgeItems,
      replyCorrections,
    });

    preparedInquiries.push(preparedInquiry);

    if (preparedInquiry.shouldCreateMissingInfo) {
      await saveMissingInfo({
        supabase: auth.supabase,
        userId: auth.userId,
        inquiry,
        store: preparedInquiry.store,
      });
    }
  }

  const rows = preparedInquiries.map((preparedInquiry) => preparedInquiry.row);

  if (rows.length > 0) {
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
        {
          error: "Failed to save Smartstore inquiries.",
          detail: insertError.message,
        },
        { status: 500 },
      );
    }
  }

  const correctionPausedCount = preparedInquiries.filter(
    (preparedInquiry) =>
      preparedInquiry.decision.guardType === "correction_learning",
  ).length;

  if (correctionPausedCount > 0) {
    await recordAiActivityLog(auth.supabase, {
      userId: auth.userId,
      eventType: "platform_inquiries_auto_completion_paused",
      title: "스마트스토어 문의 자동 완료를 멈췄습니다",
      description: `비슷한 답변을 사장님이 반복 수정한 기록이 있어 ${correctionPausedCount}건을 확인 필요로 분류했습니다.`,
      relatedType: "cs_message",
      status: "needs_review",
      handlingType: "needs_review",
      riskLevel: "normal",
      sourcePlatform: "smartstore",
      metadata: {
        platform: "smartstore",
        correctionPausedCount,
        importedCount: rows.length,
      },
    });
  }

  await updateCredentialStatus(auth.supabase, auth.userId, "connected");

  return Response.json({
    imported: rows.length,
    skipped: fetchResult.inquiries.length - rows.length,
    message: "스마트스토어 문의를 AI CS 처리함에 추가했습니다.",
  });
}
