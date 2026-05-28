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

    const reviewRows = results.map((result) => ({
      user_id: auth.userId,
      review: result.review,
      reply: result.reply,
      sentiment: result.sentiment,
      status: "pending",
      handling_type: result.handlingType,
      risk_level: result.riskLevel,
    }));

    let { error: saveError } = await auth.supabase.from("reviews").insert(
      reviewRows,
    );

    if (saveError && /(handling_type|risk_level)/i.test(saveError.message)) {
      console.warn(
        "reviews handling columns are missing. Run: alter table reviews add column if not exists handling_type text default 'needs_approval'; alter table reviews add column if not exists risk_level text default 'normal';",
      );
      const fallbackRows = results.map((result) => ({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status: "pending",
      }));
      const fallback = await auth.supabase.from("reviews").insert(fallbackRows);
      saveError = fallback.error;
    }

    if (saveError && /status/i.test(saveError.message)) {
      const fallbackRows = results.map((result) => ({
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
      results: results.map((result) => ({
        ...result,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
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
