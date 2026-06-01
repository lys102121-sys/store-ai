import OpenAI from "openai";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import type { ReviewReplyPromptStore } from "@/app/lib/prompts/reviewReplyPrompt";
import {
  generateReviewReplyWithSentiment,
  reviewReplyStoreSelect,
} from "@/app/lib/reviewReplyGeneration";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type MockReviewPlatform =
  | "baemin"
  | "yogiyo"
  | "coupangeats"
  | "coupang";

type MockPlatformReviewsConfig = {
  platform: MockReviewPlatform;
  platformName: string;
  reviews: readonly string[];
};

const healthSafetyPattern =
  /알레르기|알러지|두드러기|발진|붉어|복통|배가\s*아프|식중독|상한|이상\s*반응|호흡|병원|아프다|먹고\s*탈|피부\s*반응|가려|위생/;

const safeHealthReviewReply =
  "불편을 겪으셨다니 걱정되는 마음입니다. 정확한 확인을 위해 주문 정보와 함께 문의 남겨주시면 원재료와 안내 사항을 확인해보겠습니다. 증상이 계속되거나 심한 경우에는 의료기관 상담을 권장드립니다.";

export async function createMockPlatformReviewsResponse(
  request: Request,
  { platform, platformName, reviews }: MockPlatformReviewsConfig,
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

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(reviewReplyStoreSelect)
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
    const storeSettings = store as unknown as ReviewReplyPromptStore;
    const results = [];

    for (const review of reviews) {
      const generated = await generateReviewReplyWithSentiment(
        openai,
        storeSettings,
        review,
      );
      const hasHealthSafetyIssue = healthSafetyPattern.test(review);

      results.push({
        ...generated,
        reply: hasHealthSafetyIssue ? safeHealthReviewReply : generated.reply,
        handlingType: hasHealthSafetyIssue
          ? ("needs_approval" as const)
          : generated.handlingType,
        riskLevel: hasHealthSafetyIssue
          ? ("high" as const)
          : generated.riskLevel,
      });
    }

    const timestamp = Date.now();
    const rows = results.map((result, index) => {
      const status =
        storeSettings.auto_complete_positive_reviews &&
        result.sentiment === "positive" &&
        result.handlingType === "auto_ready" &&
        result.riskLevel === "low"
          ? "completed"
          : result.handlingType === "needs_review"
            ? "needs_review"
            : "pending";

      return {
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
        source_platform: platform,
        external_id: `mock-${platform}-review-${timestamp}-${index + 1}`,
        external_url: null,
        platform_status: "synced",
      };
    });

    const { error: insertError } = await auth.supabase
      .from("reviews")
      .insert(rows);

    if (insertError) {
      return Response.json(
        {
          error: `Failed to save mock ${platform} reviews.`,
          detail: insertError.message,
        },
        { status: 500 },
      );
    }

    return Response.json({
      inserted: rows.length,
      message: `${platformName} 샘플 리뷰가 AI CS 처리함에 추가되었습니다.`,
    });
  } catch (error) {
    return Response.json(
      {
        error: `Failed to generate mock ${platform} reviews.`,
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
