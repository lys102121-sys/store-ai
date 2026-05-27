import OpenAI from "openai";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  generateReviewReplyWithSentiment,
  reviewReplyStoreSelect,
} from "@/app/lib/reviewReplyGeneration";
import type { ReviewReplyPromptStore } from "@/app/lib/prompts/reviewReplyPrompt";

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
    const result = await generateReviewReplyWithSentiment(
      openai,
      storeSettings,
      review,
    );

    const { error: reviewSaveError } = await auth.supabase
      .from("reviews")
      .insert({
        user_id: auth.userId,
        review: result.review,
        reply: result.reply,
        sentiment: result.sentiment,
      });

    if (reviewSaveError) {
      return Response.json(
        { error: "Failed to save review.", detail: reviewSaveError.message },
        { status: 500 },
      );
    }

    return Response.json({ reply: result.reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI API error.";

    return Response.json(
      { error: "Failed to call OpenAI API.", detail: message },
      { status: 500 },
    );
  }
}
