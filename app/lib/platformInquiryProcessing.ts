import {
  generateCsReplyDecision,
  type CsReplyDecision,
} from "@/app/lib/csReplyGeneration";
import {
  buildPlatformInquiryPromptContext,
  type NormalizedPlatformInquiry,
} from "@/app/lib/platformInquiry";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import type { UsedStoreKnowledgeItem } from "@/app/lib/storeKnowledge";

export async function generatePlatformInquiryDecision({
  inquiry,
  store,
}: {
  inquiry: NormalizedPlatformInquiry;
  store: CsReplyPromptStore;
}) {
  return generateCsReplyDecision({
    customerMessage: inquiry.content,
    store,
    context: buildPlatformInquiryPromptContext(inquiry),
  });
}

export function shouldCreateMissingInfoForPlatformInquiry({
  decision,
  hasMissingInfoSignal = false,
}: {
  decision: CsReplyDecision;
  hasMissingInfoSignal?: boolean;
}) {
  return (
    decision.guardType !== "workflow_verification" &&
    (decision.handlingType === "needs_review" || hasMissingInfoSignal)
  );
}

export function createPlatformCsMessageRow({
  userId,
  inquiry,
  decision,
  status,
  usedKnowledgeItems,
}: {
  userId: string;
  inquiry: NormalizedPlatformInquiry;
  decision: CsReplyDecision;
  status: string;
  usedKnowledgeItems: UsedStoreKnowledgeItem[];
}) {
  return {
    user_id: userId,
    customer_message: inquiry.content,
    reply: decision.reply,
    status,
    handling_type: decision.handlingType,
    risk_level: decision.riskLevel,
    ai_reason: decision.aiReason,
    used_knowledge_items: usedKnowledgeItems,
    source_platform: inquiry.sourcePlatform,
    external_id: inquiry.externalId,
    external_url: inquiry.externalUrl,
    platform_status: "synced",
  };
}
