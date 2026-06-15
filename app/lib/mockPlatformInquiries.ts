import {
  isMissingAiReasonColumnError,
  withoutAiReason,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  createNormalizedPlatformInquiry,
  type PlatformSource,
} from "@/app/lib/platformInquiry";
import { preparePlatformInquiryForStorage } from "@/app/lib/platformInquiryProcessing";
import { loadCsReplyCorrections } from "@/app/lib/csReplyCorrectionLearning";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  isMissingUsedKnowledgeColumnError,
  loadStoreKnowledgeItems,
  warnMissingUsedKnowledgeColumn,
  withoutUsedKnowledgeItems,
} from "@/app/lib/storeKnowledge";

export type MockInquiryPlatform = Exclude<PlatformSource, "manual">;

type MockPlatformInquiriesConfig = {
  platform: MockInquiryPlatform;
  platformName: string;
  inquiries: readonly string[];
};

const mockInquiryStoreSelect =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, ai_work_mode, ai_work_start_time, ai_work_end_time, created_at, updated_at";
const legacyMockInquiryStoreSelect =
  "user_id, store_name, business_type, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_cs_examples, auto_complete_low_risk_cs, created_at, updated_at";

export async function createMockPlatformInquiriesResponse(
  request: Request,
  { platform, platformName, inquiries }: MockPlatformInquiriesConfig,
) {
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

  let { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(mockInquiryStoreSelect)
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
      .select(legacyMockInquiryStoreSelect)
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
      { status: 404 },
    );
  }

  try {
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
    const timestamp = Date.now();
    const normalizedInquiries = inquiries.map((content, index) =>
      createNormalizedPlatformInquiry({
        sourcePlatform: platform,
        externalId: `mock-${platform}-${timestamp}-${index + 1}`,
        content,
        productName: null,
        createdAt: new Date(timestamp).toISOString(),
        externalUrl: null,
      }),
    );
    const rows = await Promise.all(
      normalizedInquiries.map(async (inquiry) => {
        const preparedInquiry = await preparePlatformInquiryForStorage({
          userId: auth.userId,
          inquiry,
          baseStore: baseStoreRow,
          storeKnowledgeItems,
          replyCorrections,
        });

        return preparedInquiry.row;
      }),
    );

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
          error: `Failed to save mock ${platform} inquiries.`,
          detail: insertError.message,
        },
        { status: 500 },
      );
    }

    return Response.json({
      inserted: rows.length,
      message: `${platformName} 샘플 문의가 AI CS 처리함에 추가되었습니다.`,
    });
  } catch (error) {
    return Response.json(
      {
        error: `Failed to generate mock ${platform} inquiries.`,
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
