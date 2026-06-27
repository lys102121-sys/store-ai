import OpenAI from "openai";

import {
  buildAiCsAgentRuntimeInstruction,
  buildAiCsAgentRuntimePlan,
} from "@/app/lib/aiCsAgentRuntime";
import { buildReviewAiReason } from "@/app/lib/aiDecisionReason";
import { buildProductSafetyReviewReply } from "@/app/lib/csIncidentResponse";
import { applyCsServiceEscalation } from "@/app/lib/csServiceEscalation";
import {
  buildReviewReplySystemPrompt,
  type ReviewReplyPromptStore,
} from "@/app/lib/prompts/reviewReplyPrompt";
import {
  hasHealthSafetySignal,
  hasProductSafetySignal,
} from "@/app/lib/riskSignals";

export type Sentiment = "positive" | "neutral" | "negative";
export type HandlingType = "auto_ready" | "needs_review" | "needs_approval";
export type RiskLevel = "low" | "normal" | "high";

export type ReviewReplyGenerationResult = {
  review: string;
  reply: string;
  sentiment: Sentiment;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
  aiReason: string;
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
  "auto_complete_positive_reviews",
  "ai_work_mode",
  "ai_work_start_time",
  "ai_work_end_time",
].join(", ");

export const legacyReviewReplyStoreSelect = [
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
  "auto_complete_positive_reviews",
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

function parseReviewReplyDecision(output: string | undefined): {
  reply: string;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
} | null {
  if (!output) return null;

  try {
    const parsed = JSON.parse(output) as {
      reply?: unknown;
      handling_type?: unknown;
      risk_level?: unknown;
    };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const handlingType =
      parsed.handling_type === "auto_ready" ||
      parsed.handling_type === "needs_review" ||
      parsed.handling_type === "needs_approval"
        ? parsed.handling_type
        : null;
    const riskLevel =
      parsed.risk_level === "low" ||
      parsed.risk_level === "normal" ||
      parsed.risk_level === "high"
        ? parsed.risk_level
        : null;

    if (reply && handlingType && riskLevel) {
      return { reply, handlingType, riskLevel };
    }
  } catch {
    const reply = output.trim();
    if (reply) {
      return {
        reply,
        handlingType: "needs_approval",
        riskLevel: "normal",
      };
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
          "You classify only the sentiment of a Korean customer review.",
          "Return one of: positive, neutral, negative.",
          'Return JSON only: {"sentiment":"positive"|"neutral"|"negative"}',
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
): Promise<{
  reply: string;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
}> {
  const agentPlan = buildAiCsAgentRuntimePlan({
    surface: "review_reply",
    text: review,
  });
  const systemPrompt = [
    buildReviewReplySystemPrompt(store),
    buildAiCsAgentRuntimeInstruction(agentPlan),
  ].join("\n\n");
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
            text: [
              `고객 리뷰:\n${review}`,
              "",
              "리뷰 답글 초안과 AI 처리 판단을 함께 작성하세요.",
              "handling_type은 auto_ready, needs_review, needs_approval 중 하나입니다.",
              "risk_level은 low, normal, high 중 하나입니다.",
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "review_reply_decision",
        schema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            handling_type: {
              type: "string",
              enum: ["auto_ready", "needs_review", "needs_approval"],
            },
            risk_level: {
              type: "string",
              enum: ["low", "normal", "high"],
            },
          },
          required: ["reply", "handling_type", "risk_level"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  });

  const decision = parseReviewReplyDecision(completion.output_text?.trim());

  if (!decision) {
    throw new Error("Failed to generate a review reply.");
  }

  return decision;
}

export async function generateReviewReplyWithSentiment(
  openai: OpenAI,
  store: ReviewReplyPromptStore,
  review: string,
): Promise<ReviewReplyGenerationResult> {
  const [sentiment, decision] = await Promise.all([
    analyzeReviewSentiment(openai, review),
    generateReviewReply(openai, store, review),
  ]);
  const hasHealthSafetyIssue = hasHealthSafetySignal(review);
  const hasProductSafetyIssue = hasProductSafetySignal(review);

  const escalatedDecision = applyCsServiceEscalation(review, {
    ...decision,
    handlingType: hasHealthSafetyIssue
      ? ("needs_approval" as const)
      : decision.handlingType,
    riskLevel: hasHealthSafetyIssue
      ? ("high" as const)
      : decision.riskLevel,
    aiReason: "",
  });
  const handlingType = escalatedDecision.handlingType;
  const riskLevel = escalatedDecision.riskLevel;

  return {
    review,
    reply: hasProductSafetyIssue
      ? buildProductSafetyReviewReply()
      : decision.reply,
    sentiment,
    handlingType,
    riskLevel,
    aiReason:
      escalatedDecision.aiReason ||
      buildReviewAiReason({
        review,
        sentiment,
        handlingType,
        riskLevel,
      }),
  };
}
