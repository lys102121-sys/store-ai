import OpenAI from "openai";

import { buildCsAiReason } from "@/app/lib/aiDecisionReason";
import { buildProductSafetyReply } from "@/app/lib/csIncidentResponse";
import { applyOperationalInfoGuard } from "@/app/lib/csOperationalInfo";
import { findMissingOperationalInfo } from "@/app/lib/csOperationalInfo";
import { buildCsReplySystemPrompt } from "@/app/lib/prompts/csReplyPrompt";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  hasHealthSafetySignal,
  hasProductSafetySignal,
} from "@/app/lib/riskSignals";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type CsReplyHandlingType =
  | "auto_ready"
  | "needs_review"
  | "needs_approval";
export type CsReplyRiskLevel = "low" | "normal" | "high";

export type CsReplyDecision = {
  reply: string;
  handlingType: CsReplyHandlingType;
  riskLevel: CsReplyRiskLevel;
  aiReason: string;
  guardType?: "workflow_verification";
};

function parseCsReplyDecision(
  output: string | undefined,
): CsReplyDecision | null {
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

    return reply && handlingType && riskLevel
      ? { reply, handlingType, riskLevel, aiReason: "" }
      : null;
  } catch {
    return null;
  }
}

function sanitizeCustomerReply(reply: string) {
  return reply
    .replaceAll("현재 등록된 정보만으로는", "정확한 안내를 위해서는")
    .replaceAll("현재 등록된 정보", "현재 확인 가능한 내용")
    .replaceAll("등록된 정보만으로는", "정확한 안내를 위해서는")
    .replaceAll(
      "상품 정보에 명시되어 있지 않습니다",
      "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다",
    )
    .replaceAll("사장님 확인이 필요합니다", "확인 후 안내드리겠습니다")
    .replaceAll("사장님 확인", "확인")
    .replaceAll("저장된 정보", "확인 가능한 내용")
    .replaceAll("등록된 정보", "확인 가능한 내용")
    .replaceAll("시스템", "")
    .replaceAll("AI", "")
    .replaceAll("데이터", "내용")
    .replaceAll("DB", "")
    .trim();
}

export async function generateCsReplyDecision({
  customerMessage,
  store,
  context,
}: {
  customerMessage: string;
  store: CsReplyPromptStore;
  context?: string | null;
}): Promise<CsReplyDecision> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const completion = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: buildCsReplySystemPrompt(store),
      },
      {
        role: "user",
        content: `${context?.trim() ? `${context.trim()}\n` : ""}고객 문의:\n${customerMessage}\n\n저장된 CS 응대 예시가 있으면 그 말투를 우선 따르고, 없으면 친절하고 자연스럽게 답변하세요.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cs_reply_decision",
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

  const parsedDecision = parseCsReplyDecision(completion.output_text?.trim());
  if (!parsedDecision) {
    throw new Error("Failed to generate a CS reply.");
  }

  const hasHealthSafetyIssue = hasHealthSafetySignal(customerMessage);
  const hasProductSafetyIssue = hasProductSafetySignal(customerMessage);
  const missingOperationalInfo = findMissingOperationalInfo(
    customerMessage,
    store,
  );
  const initialDecision: CsReplyDecision = {
    reply: hasProductSafetyIssue
      ? buildProductSafetyReply(store)
      : sanitizeCustomerReply(parsedDecision.reply),
    handlingType: hasHealthSafetyIssue
      ? ("needs_approval" as const)
      : parsedDecision.handlingType,
    riskLevel: hasHealthSafetyIssue
      ? ("high" as const)
      : parsedDecision.riskLevel,
    aiReason: "",
  };
  const decision =
    (!hasHealthSafetyIssue &&
      applyOperationalInfoGuard({
        customerMessage,
        reply: initialDecision.reply,
        store,
      })) ||
    initialDecision;

  if (!decision.reply) {
    throw new Error("Failed to generate a CS reply.");
  }

  return {
    ...decision,
    aiReason:
      decision.aiReason ||
      buildCsAiReason({
        customerMessage,
        handlingType: decision.handlingType,
        riskLevel: decision.riskLevel,
        missingOperationalInfo,
      }),
  };
}
