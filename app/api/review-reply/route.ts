import OpenAI from "openai";

import { requireAuthenticatedUser } from "@/app/lib/auth";
import { buildReviewReplySystemPrompt } from "@/app/lib/prompts/reviewReplyPrompt";
import type { ReviewReplyPromptStore } from "@/app/lib/prompts/reviewReplyPrompt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Sentiment = "positive" | "neutral" | "negative";

type RequestBody = {
  review?: unknown;
  tone?: unknown;
};

type StoreRow = ReviewReplyPromptStore;



function parseSentiment(output: string | undefined): Sentiment | null {
  if (!output) return null;

  try {
    const parsed = JSON.parse(output) as { sentiment?: string };
    if (
      parsed.sentiment === "positive" ||
      parsed.sentiment === "neutral" ||
      parsed.sentiment === "negative"
    ) {
      return parsed.sentiment;
    }
  } catch {
    const token = output.trim().toLowerCase();
    if (token === "positive" || token === "neutral" || token === "negative") {
      return token;
    }
  }

  return null;
}

async function analyzeSentiment(review: string): Promise<Sentiment> {
  const completion = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "당신은 고객 리뷰의 감정을 분류하는 분석기입니다.",
          "리뷰 텍스트만 보고 sentiment를 다음 중 정확히 하나로 판별하세요: positive, neutral, negative.",
          "",
          "예시:",
          '- "맛있어요" → positive',
          '- "그냥 평범했어요" → neutral',
          '- "다신 안 시켜먹을래요" → negative',
          "",
          'JSON만 출력: {"sentiment":"positive"|"neutral"|"negative"}',
        ].join("\n"),
      },
      {
        role: "user",
        content: [{ type: "input_text", text: review }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sentiment_analysis",
        schema: {
          type: "object",
          properties: {
            sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
            },
          },
          required: ["sentiment"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  const sentiment = parseSentiment(completion.output_text?.trim());
  if (!sentiment) {
    throw new Error("Failed to parse sentiment from OpenAI response.");
  }

  return sentiment;
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

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const review =
    typeof body.review === "string" ? body.review.trim() : "";
  const tone = typeof body.tone === "string" ? body.tone.trim() : "";

  if (!review || !tone) {
    return Response.json(
      { error: "Both 'review' and 'tone' must be non-empty strings." },
      { status: 400 },
    );
  }

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select("store_name, tone, shipping_policy, refund_policy")
    .eq("user_id", auth.userId)
    .order("id", { ascending: false })
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
        error:
          "No store found. Save store settings first, then try again.",
      },
      { status: 404 },
    );
  }

  const systemPrompt = buildReviewReplySystemPrompt(store as StoreRow);

  try {
    const [sentiment, completion] = await Promise.all([
      analyzeSentiment(review),
      openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `고객 리뷰:\n${review}\n\n이번 답글에 추가로 반영할 말투·요청:\n${tone}\n\n위 말투는 가게 기본 톤과 어긋나지 않게 조화롭게 반영하세요.`,
              },
            ],
          },
        ],
      }),
    ]);

    const reply = completion.output_text?.trim();

    if (!reply) {
      return Response.json(
        { error: "Failed to generate a review reply." },
        { status: 502 },
      );
    }

    const { error: reviewSaveError } = await auth.supabase
      .from("reviews")
      .insert({
        user_id: auth.userId,
        review,
        reply,
        sentiment,
      });

    if (reviewSaveError) {
      return Response.json(
        { error: "Failed to save review.", detail: reviewSaveError.message },
        { status: 500 },
      );
    }

    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI API error.";

    return Response.json(
      { error: "Failed to call OpenAI API.", detail: message },
      { status: 500 },
    );
  }
}
