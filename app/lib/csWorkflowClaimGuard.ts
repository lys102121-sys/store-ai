import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

const completedWorkflowClaimPattern =
  /(?:입금|결제)[^.!?\n]{0,24}(?:확인|완료|처리)(?:되었습니다|됐습니다|완료되었습니다)|(?:A\/S|AS|반품|교환|환불|취소|회수|수리|검수|재출고|출고|발송|배송)?\s*접수[^.!?\n]{0,24}(?:완료|되었습니다|됐습니다|처리되었습니다)|(?:회수|수리|검수|교환|환불|취소|재출고|출고|발송|배송)[^.!?\n]{0,28}(?:완료되었습니다|완료됐습니다|처리되었습니다|처리됐습니다|되었습니다|됐습니다)/i;

const scheduledWorkflowClaimPattern =
  /(?:고객님|주문하신|해당\s*주문|문의하신\s*건|접수하신\s*건)[^.!?\n]{0,45}(?:오늘|금일|내일|\d{1,2}\s*시)[^.!?\n]{0,30}(?:출고|발송|배송|회수|방문)[^.!?\n]{0,20}(?:예정|진행)/;

const trackingNumberClaimPattern =
  /(?:송장|운송장)\s*번호\s*(?::|은|는)?\s*[0-9][0-9\s-]{7,}/;

export function hasUnverifiedWorkflowClaim(reply: string) {
  return (
    completedWorkflowClaimPattern.test(reply) ||
    scheduledWorkflowClaimPattern.test(reply) ||
    trackingNumberClaimPattern.test(reply)
  );
}

function getGreeting(store: CsReplyPromptStore) {
  const storeName = store.store_name?.trim();

  return storeName ? `안녕하세요, ${storeName}입니다.` : "안녕하세요.";
}

export function buildWorkflowVerificationReply({
  customerMessage,
  store,
}: {
  customerMessage: string;
  store: CsReplyPromptStore;
}) {
  const informationLabel = /A\/S|AS|수리|교환|반품|환불|회수|접수/.test(
    customerMessage,
  )
    ? "접수 정보"
    : "주문 또는 접수 정보";

  return `${getGreeting(store)} 정확한 진행 상태는 확인 후 안내드리겠습니다. ${informationLabel}를 알려주시면 확인해보겠습니다.`;
}

export function applyWorkflowClaimGuard({
  customerMessage,
  reply,
  store,
}: {
  customerMessage: string;
  reply: string;
  store: CsReplyPromptStore;
}) {
  if (!hasUnverifiedWorkflowClaim(reply)) return null;

  return {
    reply: buildWorkflowVerificationReply({ customerMessage, store }),
    handlingType: "needs_review" as const,
    riskLevel: "normal" as const,
    missingInfo: null,
    guardType: "workflow_verification" as const,
    aiReason:
      "실제 주문, 결제, 접수 또는 배송 진행 상태를 확인해야 정확하게 안내할 수 있습니다.",
  };
}
