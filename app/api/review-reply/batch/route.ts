import OpenAI from "openai";

import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import type { ReviewReplyPromptStore } from "@/app/lib/prompts/reviewReplyPrompt";
import {
  generateReviewReplyWithSentiment,
  reviewReplyStoreSelect,
} from "@/app/lib/reviewReplyGeneration";
import { resolveReviewWorkflowStatus } from "@/app/lib/workflowStatus";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_BATCH_REVIEWS = 10;
const MAX_REVIEW_LENGTH = 1000;

type BatchReviewReplyRequestBody = {
  reviews?: unknown;
};

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

  let body: BatchReviewReplyRequestBody;

  try {
    body = (await request.json()) as BatchReviewReplyRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.reviews)) {
    return Response.json(
      { error: "'reviews' must be an array of strings." },
      { status: 400 },
    );
  }

  const reviews = body.reviews
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (reviews.length === 0) {
    return Response.json(
      { error: "At least one review is required." },
      { status: 400 },
    );
  }

  if (reviews.length > MAX_BATCH_REVIEWS) {
    return Response.json(
      { error: "You can generate up to 10 review replies at once." },
      { status: 400 },
    );
  }

  const tooLongReview = reviews.find(
    (review) => review.length > MAX_REVIEW_LENGTH,
  );

  if (tooLongReview) {
    return Response.json(
      {
        error: `Each review must be ${MAX_REVIEW_LENGTH} characters or fewer.`,
      },
      { status: 400 },
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
      {
        error: "No store found. Save store settings first, then try again.",
      },
      { status: 404 },
    );
  }

  const storeSettings = store as unknown as ReviewReplyPromptStore;

  try {
    const results = [];

    for (const review of reviews) {
      const result = await generateReviewReplyWithSentiment(
        openai,
        storeSettings,
        review,
      );

      results.push(result);
    }

    const resultsWithStatus = results.map((result) => {
      const status = resolveReviewWorkflowStatus({
        autoCompletePositiveReviews:
          storeSettings.auto_complete_positive_reviews,
        sentiment: result.sentiment,
        handlingType: result.handlingType,
        riskLevel: result.riskLevel,
      });

      return { ...result, status };
    });

    const reviewRows = resultsWithStatus.map((result) => ({
      user_id: auth.userId,
      review: result.review,
      reply: result.reply,
      sentiment: result.sentiment,
      status: result.status,
      handling_type: result.handlingType,
      risk_level: result.riskLevel,
      ai_reason: result.aiReason,
      source_platform: "manual",
      external_id: null,
      external_url: null,
      platform_status: "local",
    }));

    let { error: saveError } = await auth.supabase.from("reviews").insert(
      reviewRows,
    );

    if (isMissingAiReasonColumnError(saveError)) {
      warnMissingAiReasonColumns();
      const fallbackRows = resultsWithStatus.map((result) => ({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status: result.status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
        source_platform: "manual",
        external_id: null,
        external_url: null,
        platform_status: "local",
      }));
      const fallback = await auth.supabase.from("reviews").insert(fallbackRows);
      saveError = fallback.error;
    }

    if (
      saveError &&
      /(source_platform|external_id|external_url|platform_status)/i.test(
        saveError.message,
      )
    ) {
      console.warn(
        "reviews platform columns are missing. Run: alter table reviews add column if not exists source_platform text default 'manual'; alter table reviews add column if not exists external_id text; alter table reviews add column if not exists external_url text; alter table reviews add column if not exists platform_status text default 'local';",
      );
      const fallbackRows = resultsWithStatus.map((result) => ({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status: result.status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
      }));
      const fallback = await auth.supabase.from("reviews").insert(fallbackRows);
      saveError = fallback.error;
    }

    if (saveError && /(handling_type|risk_level)/i.test(saveError.message)) {
      console.warn(
        "reviews handling columns are missing. Run: alter table reviews add column if not exists handling_type text default 'needs_approval'; alter table reviews add column if not exists risk_level text default 'normal';",
      );
      const fallbackRows = resultsWithStatus.map((result) => ({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status: result.status,
      }));
      const fallback = await auth.supabase.from("reviews").insert(fallbackRows);
      saveError = fallback.error;
    }

    if (saveError && /status/i.test(saveError.message)) {
      const fallbackRows = resultsWithStatus.map((result) => ({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
      }));
      const fallback = await auth.supabase.from("reviews").insert(fallbackRows);
      saveError = fallback.error;
    }

    if (saveError) {
      return Response.json(
        { error: "Failed to save reviews.", detail: saveError.message },
        { status: 500 },
      );
    }

    return Response.json({
      results: resultsWithStatus.map((result) => ({
        ...result,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
        ai_reason: result.aiReason,
      })),
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
