import {
  generateCsReplyDecision,
  type CsReplyDecision,
} from "@/app/lib/csReplyGeneration";
import {
  buildCsReplyCorrectionPrompt,
  type CsReplyCorrection,
} from "@/app/lib/csReplyCorrectionLearning";
import {
  buildPlatformInquiryKnowledgeText,
  buildPlatformInquiryPromptContext,
  type NormalizedPlatformInquiry,
} from "@/app/lib/platformInquiry";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  createStoreInfoEvidenceSnapshot,
  createUsedKnowledgeSnapshot,
  mergeStoreKnowledgeIntoStore,
  mergeUsedKnowledgeSnapshots,
  selectRelevantStoreKnowledgeItems,
  type StoreKnowledgeItem,
  type UsedStoreKnowledgeItem,
} from "@/app/lib/storeKnowledge";
import { resolveCsWorkflowStatus } from "@/app/lib/workflowStatus";

export async function generatePlatformInquiryDecision({
  inquiry,
  store,
  replyCorrections = [],
}: {
  inquiry: NormalizedPlatformInquiry;
  store: CsReplyPromptStore;
  replyCorrections?: CsReplyCorrection[];
}) {
  return generateCsReplyDecision({
    customerMessage: inquiry.content,
    store,
    context: buildPlatformInquiryPromptContext(inquiry),
    correctionContext: buildCsReplyCorrectionPrompt(
      inquiry.content,
      replyCorrections,
    ),
    replyCorrections,
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
    decision.guardType !== "output_validation" &&
    decision.guardType !== "correction_learning" &&
    (decision.handlingType === "needs_review" || hasMissingInfoSignal)
  );
}

export function hasMissingInfoReplySignal(reply: string) {
  return /정확한\s*안내를\s*위해\s*확인|확인\s*후\s*(다시\s*)?(말씀|안내)|정확한\s*확인\s*후\s*안내/.test(
    reply,
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

export async function preparePlatformInquiryForStorage({
  userId,
  inquiry,
  baseStore,
  storeKnowledgeItems,
  replyCorrections = [],
}: {
  userId: string;
  inquiry: NormalizedPlatformInquiry;
  baseStore: CsReplyPromptStore;
  storeKnowledgeItems: StoreKnowledgeItem[];
  replyCorrections?: CsReplyCorrection[];
}) {
  const inquiryKnowledgeText = buildPlatformInquiryKnowledgeText(inquiry);
  const relevantStoreKnowledgeItems = selectRelevantStoreKnowledgeItems(
    inquiryKnowledgeText,
    storeKnowledgeItems,
  );
  const store = mergeStoreKnowledgeIntoStore(
    baseStore,
    relevantStoreKnowledgeItems,
  );
  const usedKnowledgeItems = mergeUsedKnowledgeSnapshots(
    createUsedKnowledgeSnapshot(relevantStoreKnowledgeItems),
    createStoreInfoEvidenceSnapshot(inquiryKnowledgeText, store),
  );
  const decision = await generatePlatformInquiryDecision({
    inquiry,
    store,
    replyCorrections,
  });
  const shouldCreateMissingInfo =
    shouldCreateMissingInfoForPlatformInquiry({
      decision,
      hasMissingInfoSignal: hasMissingInfoReplySignal(decision.reply),
    });
  const status = resolveCsWorkflowStatus({
    autoCompleteLowRisk: store.auto_complete_low_risk_cs,
    aiWorkMode: store.ai_work_mode,
    aiWorkStartTime: store.ai_work_start_time,
    aiWorkEndTime: store.ai_work_end_time,
    handlingType: decision.handlingType,
    riskLevel: decision.riskLevel,
    hasMissingInfo: shouldCreateMissingInfo,
  });

  return {
    decision,
    store,
    shouldCreateMissingInfo,
    row: createPlatformCsMessageRow({
      userId,
      inquiry,
      decision,
      status,
      usedKnowledgeItems,
    }),
  };
}
