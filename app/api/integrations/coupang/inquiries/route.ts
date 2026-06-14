import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isMissingAiReasonColumnError,
  withoutAiReason,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import { findMissingOperationalInfo } from "@/app/lib/csOperationalInfo";
import {
  COUPANG_OPEN_API_HOST,
  createCoupangAuthorization,
  createCoupangOnlineInquiryPath,
  createCoupangOnlineInquiryQuery,
  parseCoupangOnlineInquiries,
  type CoupangOnlineInquiry,
} from "@/app/lib/coupangOpenApi";
import { preparePlatformInquiryForStorage } from "@/app/lib/platformInquiryProcessing";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  warnMissingUsedKnowledgeColumn,
  withoutUsedKnowledgeItems,
} from "@/app/lib/storeKnowledge";

export const runtime = "nodejs";

function truncateForLog(value: string) {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

function buildMissingInfo(
  inquiry: CoupangOnlineInquiry,
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

  const productName = inquiry.productName
    ? ` '${inquiry.productName}'`
    : "";

  return {
    question: `${productName} 상품 문의에 답변하기 위해 필요한 정보를 등록해 주세요.`.trim(),
    reason:
      "쿠팡에서 가져온 문의에 정확히 답변하려면 상품 또는 정책 정보를 추가로 확인해야 합니다.",
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
  inquiry: CoupangOnlineInquiry;
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
    .eq("platform", "coupang");
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

  const { data: credential, error: credentialError } = await auth.supabase
    .from("platform_credentials")
    .select("vendor_id, access_key, secret_key")
    .eq("user_id", auth.userId)
    .eq("platform", "coupang")
    .maybeSingle();

  if (credentialError) {
    return Response.json(
      { error: "Failed to read Coupang credentials.", detail: credentialError.message },
      { status: 500 },
    );
  }

  const vendorId = credential?.vendor_id?.trim();
  const accessKey = credential?.access_key?.trim();
  const secretKey = credential?.secret_key?.trim();

  if (!vendorId || !accessKey || !secretKey) {
    return Response.json(
      { error: "Coupang credentials are incomplete." },
      { status: 400 },
    );
  }

  let { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(
      "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, ai_work_mode, ai_work_start_time, ai_work_end_time, created_at, updated_at",
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
        "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at",
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
      { error: "No store found. Save store settings first, then try again." },
      { status: 400 },
    );
  }

  const method = "GET";
  const path = createCoupangOnlineInquiryPath(vendorId);
  const query = createCoupangOnlineInquiryQuery({
    vendorId,
    days: 1,
    pageSize: 20,
  });
  let authorization: string;

  try {
    authorization = createCoupangAuthorization({
      method,
      path,
      query,
      accessKey,
      secretKey,
    });
  } catch (error) {
    await updateCredentialStatus(auth.supabase, auth.userId, "error");
    return Response.json(
      {
        error: "Failed to create Coupang HMAC signature.",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let coupangInquiriesFetched = false;

  try {
    const response = await fetch(`${COUPANG_OPEN_API_HOST}${path}?${query}`, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "X-Requested-By": vendorId,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = truncateForLog(await response.text());
      console.error("Failed to fetch Coupang inquiries.", {
        status: response.status,
        responseBody,
      });
      await updateCredentialStatus(auth.supabase, auth.userId, "error");
      return Response.json(
        { error: "Failed to fetch Coupang inquiries.", detail: `HTTP ${response.status}` },
        { status: 502 },
      );
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      await updateCredentialStatus(auth.supabase, auth.userId, "error");
      return Response.json(
        { error: "Failed to parse Coupang inquiry response." },
        { status: 502 },
      );
    }

    let inquiries: CoupangOnlineInquiry[];
    try {
      inquiries = parseCoupangOnlineInquiries(payload);
    } catch (error) {
      console.error("Failed to parse Coupang inquiries.", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      await updateCredentialStatus(auth.supabase, auth.userId, "error");
      return Response.json(
        {
          error: "Failed to parse Coupang inquiry response.",
          detail: error instanceof Error ? error.message : undefined,
        },
        { status: 502 },
      );
    }
    coupangInquiriesFetched = true;

    const uniqueInquiries = [
      ...new Map(inquiries.map((item) => [item.externalId, item])).values(),
    ];
    const externalIds = uniqueInquiries.map((item) => item.externalId);
    let existingExternalIds = new Set<string>();

    if (externalIds.length > 0) {
      const { data: existingRows, error: existingError } = await auth.supabase
        .from("cs_messages")
        .select("external_id")
        .eq("user_id", auth.userId)
        .eq("source_platform", "coupang")
        .in("external_id", externalIds);

      if (existingError) {
        return Response.json(
          { error: "Failed to check existing Coupang inquiries.", detail: existingError.message },
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
    const storeKnowledgeItems = await loadStoreKnowledgeItems({
      supabase: auth.supabase,
      userId: auth.userId,
    });
    const rows = [];

    for (const inquiry of newInquiries) {
      const preparedInquiry = await preparePlatformInquiryForStorage({
        userId: auth.userId,
        inquiry,
        baseStore: baseStoreRow,
        storeKnowledgeItems,
      });

      rows.push(preparedInquiry.row);

      if (preparedInquiry.shouldCreateMissingInfo) {
        await saveMissingInfo({
          supabase: auth.supabase,
          userId: auth.userId,
          inquiry,
          store: preparedInquiry.store,
        });
      }
    }

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
          { error: "Failed to save Coupang inquiries.", detail: insertError.message },
          { status: 500 },
        );
      }
    }

    await updateCredentialStatus(auth.supabase, auth.userId, "connected");

    return Response.json({
      imported: rows.length,
      skipped: inquiries.length - rows.length,
      message: "쿠팡 문의를 AI CS 처리함에 추가했습니다.",
    });
  } catch (error) {
    console.error("Coupang inquiry import failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    if (!coupangInquiriesFetched) {
      await updateCredentialStatus(auth.supabase, auth.userId, "error");
    }
    return Response.json(
      {
        error: coupangInquiriesFetched
          ? "Failed to process Coupang inquiries."
          : "Failed to fetch Coupang inquiries.",
      },
      { status: coupangInquiriesFetched ? 500 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
