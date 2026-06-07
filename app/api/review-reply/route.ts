import OpenAI from "openai";

import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  generateReviewReplyWithSentiment,
  legacyReviewReplyStoreSelect,
  reviewReplyStoreSelect,
} from "@/app/lib/reviewReplyGeneration";
import type { ReviewReplyPromptStore } from "@/app/lib/prompts/reviewReplyPrompt";
import { resolveReviewWorkflowStatus } from "@/app/lib/workflowStatus";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  review?: unknown;
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

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const review = typeof body.review === "string" ? body.review.trim() : "";

  if (!review) {
    return Response.json(
      { error: "'review' must be a non-empty string." },
      { status: 400 },
    );
  }

  const storeResult = await auth.supabase
    .from("stores")
    .select(reviewReplyStoreSelect)
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let store = storeResult.data as Record<string, unknown> | null;
  let storeError = storeResult.error;

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
      .select(legacyReviewReplyStoreSelect)
      .eq("user_id", auth.userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    store = fallback.data
      ? {
          ...(fallback.data as unknown as Record<string, unknown>),
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
      {
        error: "No store found. Save store settings first, then try again.",
      },
      { status: 404 },
    );
  }

  const storeSettings = store as unknown as ReviewReplyPromptStore;

  try {
    const result = await generateReviewReplyWithSentiment(
      openai,
      storeSettings,
      review,
    );
    const status = resolveReviewWorkflowStatus({
      autoCompletePositiveReviews:
        storeSettings.auto_complete_positive_reviews,
      aiWorkMode: storeSettings.ai_work_mode,
      aiWorkStartTime: storeSettings.ai_work_start_time,
      aiWorkEndTime: storeSettings.ai_work_end_time,
      sentiment: result.sentiment,
      handlingType: result.handlingType,
      riskLevel: result.riskLevel,
    });

    let { error: reviewSaveError } = await auth.supabase
      .from("reviews")
      .insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
        ai_reason: result.aiReason,
        source_platform: "manual",
        external_id: null,
        external_url: null,
        platform_status: "local",
      });

    if (
      reviewSaveError &&
      /(source_platform|external_id|external_url|platform_status)/i.test(
        reviewSaveError.message,
      )
    ) {
      console.warn(
        "reviews platform columns are missing. Run: alter table reviews add column if not exists source_platform text default 'manual'; alter table reviews add column if not exists external_id text; alter table reviews add column if not exists external_url text; alter table reviews add column if not exists platform_status text default 'local';",
      );
      const fallback = await auth.supabase.from("reviews").insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
      });

      reviewSaveError = fallback.error;
    }

    if (isMissingAiReasonColumnError(reviewSaveError)) {
      warnMissingAiReasonColumns();
      const fallback = await auth.supabase.from("reviews").insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status,
        handling_type: result.handlingType,
        risk_level: result.riskLevel,
        source_platform: "manual",
        external_id: null,
        external_url: null,
        platform_status: "local",
      });

      reviewSaveError = fallback.error;
    }

    if (
      reviewSaveError &&
      /(handling_type|risk_level)/i.test(reviewSaveError.message)
    ) {
      console.warn(
        "reviews handling columns are missing. Run: alter table reviews add column if not exists handling_type text default 'needs_approval'; alter table reviews add column if not exists risk_level text default 'normal';",
      );
      const fallback = await auth.supabase.from("reviews").insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
        status,
      });

      reviewSaveError = fallback.error;
    }

    if (reviewSaveError && /status/i.test(reviewSaveError.message)) {
      const fallback = await auth.supabase.from("reviews").insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
      });

      reviewSaveError = fallback.error;
    }

    if (reviewSaveError) {
      return Response.json(
        { error: "Failed to save review.", detail: reviewSaveError.message },
        { status: 500 },
      );
    }

    return Response.json({
      reply: result.reply,
      status,
      handling_type: result.handlingType,
      risk_level: result.riskLevel,
      ai_reason: result.aiReason,
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
