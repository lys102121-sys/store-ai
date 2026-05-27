import OpenAI from "openai";

import {
  buildReviewReplySystemPrompt,
  type ReviewReplyPromptStore,
} from "@/app/lib/prompts/reviewReplyPrompt";

export type Sentiment = "positive" | "neutral" | "negative";

export type ReviewReplyGenerationResult = {
  review: string;
  reply: string;
  sentiment: Sentiment;
};

export const reviewReplyStoreSelect = [
  "store_name",
  "business_type",
  "shipping_policy",
  "refund_policy",
  "product_name",
  "product_description",
  "product_details",
  "product_caution",
  "product_catalog",
  "extra_faq",
  "owner_reply_examples",
].join(", ");

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

export async function analyzeReviewSentiment(
  openai: OpenAI,
  review: string,
): Promise<Sentiment> {
  const completion = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "당신은 고객 리뷰의 감정을 분류하는 분석기입니다.",
          "리뷰 텍스트만 보고 sentiment를 다음 중 하나로 정확히 분류하세요: positive, neutral, negative.",
          "",
          "예시:",
          '- "맛있어요" → positive',
          '- "그냥 괜찮았어요" → neutral',
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

export async function generateReviewReply(
  openai: OpenAI,
  store: ReviewReplyPromptStore,
  review: string,
): Promise<string> {
  const systemPrompt = buildReviewReplySystemPrompt(store);
  const completion = await openai.responses.create({
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
            text: `고객 리뷰:\n${review}\n\n저장된 사장님 리뷰 답글 예시가 있으면 그 말투를 우선 따르고, 없으면 친절하고 자연스럽게 답글을 작성하세요.`,
          },
        ],
      },
    ],
  });

  const reply = completion.output_text?.trim();

  if (!reply) {
    throw new Error("Failed to generate a review reply.");
  }

  return reply;
}

export async function generateReviewReplyWithSentiment(
  openai: OpenAI,
  store: ReviewReplyPromptStore,
  review: string,
): Promise<ReviewReplyGenerationResult> {
  const [sentiment, reply] = await Promise.all([
    analyzeReviewSentiment(openai, review),
    generateReviewReply(openai, store, review),
  ]);

  return { review, reply, sentiment };
}
