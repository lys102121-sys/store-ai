import { classifyCsCase, type CsCaseType } from "@/app/lib/csCaseIntake";
import { buildHealthSafetyReply } from "@/app/lib/csIncidentResponse";
import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import {
  hasDisputeSignal,
  hasHealthSafetySignal,
  hasRefundExchangeSignal,
  hasStrongComplaintSignal,
} from "@/app/lib/riskSignals";

type ReplyDecision = {
  reply: string;
  handlingType: "auto_ready" | "needs_review" | "needs_approval";
  riskLevel: "low" | "normal" | "high";
  aiReason?: string;
  guardType?: "workflow_verification" | "output_validation";
};

const verificationDeferralPattern =
  /정확한\s*안내를\s*위해\s*확인|확인\s*후\s*(?:다시\s*)?(?:말씀|안내)|정확히\s*확인한\s*뒤|확인해\s*보겠습니다/;
const unsupportedCommitmentPattern =
  /(?:환불|취소|교환|반품|재배송|재발송|다시\s*배송|재조리|다시\s*조리|재시술|다시\s*시술|재제작|다시\s*제작|보상|무상\s*처리|무료\s*처리|새\s*상품|다시\s*보내)[^.!?\n]{0,45}(?:해드리겠습니다|처리하겠습니다|진행하겠습니다|보내드리겠습니다|제공하겠습니다|완료하겠습니다)/;
const unsafeCauseClaimPattern =
  /(?:상품|제품|음식|재료|성분|시술|서비스)[^.!?\n]{0,35}(?:때문|원인)[^.!?\n]{0,20}(?:것\s*같|보입니다|추정)|(?:때문|원인)[^.!?\n]{0,20}(?:알레르기|두드러기|복통|가려움|발진|상처|화상)[^.!?\n]{0,20}(?:생긴|발생한|것\s*같)/;

const caseTypesRequiringVerification = new Set<CsCaseType>([
  "repeat_issue",
  "service_breakdown",
  "cancellation_refund",
  "request_mismatch",
  "quality_issue",
  "progress_status",
  "change_request",
]);

const suppliedFactChecks = [
  {
    customerPattern: /(?:주문\s*번호|주문번호)\s*[:#은는]?\s*[A-Za-z0-9-]{4,}/i,
    repeatedRequestPattern:
      /주문\s*번호[^.!?\n]{0,30}(?:알려|남겨|보내|확인해\s*주)/,
  },
  {
    customerPattern:
      /(?:예약\s*(?:일|날짜|일시)|방문\s*(?:일|날짜|일시))\s*[:은는]?\s*(?:\d{1,2}[월/.\-]\s*\d{1,2}|오늘|내일|모레)/,
    repeatedRequestPattern:
      /(?:예약|방문)\s*(?:일|날짜|일시)[^.!?\n]{0,30}(?:알려|남겨|확인해\s*주)/,
  },
  {
    customerPattern:
      /(?:상품명|제품명|메뉴명|서비스명)\s*[:은는]?\s*[0-9A-Za-z가-힣][^.!?\n]{1,40}/,
    repeatedRequestPattern:
      /(?:상품명|제품명|메뉴명|서비스명)[^.!?\n]{0,30}(?:알려|남겨|보내|확인해\s*주)/,
  },
];

function getGreeting(store: CsReplyPromptStore) {
  const storeName = store.store_name?.trim();

  return storeName ? `안녕하세요, ${storeName}입니다.` : "안녕하세요.";
}

function buildSafeVerificationReply({
  caseType,
  store,
}: {
  caseType: CsCaseType;
  store: CsReplyPromptStore;
}) {
  const greeting = getGreeting(store);

  if (caseType === "cancellation_refund") {
    return `${greeting} 요청하신 내용을 확인했습니다. 정확한 처리를 위해 현재 주문·예약 상태와 적용 기준을 확인한 뒤 안내드리겠습니다.`;
  }

  if (caseType === "request_mismatch") {
    return `${greeting} 요청하신 내용과 다르게 제공되어 불편을 드려 죄송합니다. 원래 요청 내용과 실제 제공 결과를 확인한 뒤 처리 방법을 안내드리겠습니다.`;
  }

  if (caseType === "repeat_issue" || caseType === "service_breakdown") {
    return `${greeting} 같은 문제로 다시 불편을 드려 죄송합니다. 이전 요청과 현재 처리 상태를 함께 확인한 뒤 안내드리겠습니다.`;
  }

  if (caseType === "quality_issue") {
    return `${greeting} 이용에 불편을 드려 죄송합니다. 말씀해주신 문제와 현재 상태를 정확히 확인한 뒤 처리 방법을 안내드리겠습니다.`;
  }

  if (caseType === "progress_status") {
    return `${greeting} 정확한 진행 상태는 확인 후 안내드리겠습니다.`;
  }

  if (caseType === "change_request") {
    return `${greeting} 요청하신 변경 내용과 현재 진행 단계를 확인한 뒤 가능 여부를 안내드리겠습니다.`;
  }

  return `${greeting} 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.`;
}

function hasRepeatedFactRequest(customerMessage: string, reply: string) {
  return suppliedFactChecks.some(
    ({ customerPattern, repeatedRequestPattern }) =>
      customerPattern.test(customerMessage) && repeatedRequestPattern.test(reply),
  );
}

function createValidationDecision({
  reply,
  reason,
  riskLevel = "normal",
  handlingType,
}: {
  reply: string;
  reason: string;
  riskLevel?: "normal" | "high";
  handlingType?: "needs_review" | "needs_approval";
}): ReplyDecision {
  return {
    reply,
    handlingType:
      handlingType ??
      (riskLevel === "high" ? "needs_approval" : "needs_review"),
    riskLevel,
    aiReason: reason,
    guardType: "output_validation",
  };
}

export function validateCsReplyOutput({
  customerMessage,
  decision,
  store,
}: {
  customerMessage: string;
  decision: ReplyDecision;
  store: CsReplyPromptStore;
}): ReplyDecision {
  const caseType = classifyCsCase(customerMessage).type;
  const hasHealthIssue = hasHealthSafetySignal(customerMessage);

  if (
    hasHealthIssue &&
    (decision.handlingType !== "needs_approval" ||
      decision.riskLevel !== "high" ||
      unsafeCauseClaimPattern.test(decision.reply) ||
      !/(걱정|불편|죄송)/.test(decision.reply) ||
      !/(확인|알려|문의)/.test(decision.reply))
  ) {
    return createValidationDecision({
      reply: buildHealthSafetyReply(store),
      riskLevel: "high",
      reason:
        "건강·안전 문의의 위험 등급 또는 답변 방식이 안전 기준을 충족하지 않아 원인 단정 없는 확인 답변으로 전환했습니다.",
    });
  }

  if (hasDisputeSignal(customerMessage) || hasStrongComplaintSignal(customerMessage)) {
    decision = {
      ...decision,
      handlingType: "needs_approval",
      riskLevel: "high",
      aiReason:
        decision.aiReason ||
        "강한 불만 또는 분쟁 가능성이 있어 자동 완료하지 않고 사장님 승인이 필요합니다.",
      guardType: decision.guardType,
    };
  }

  if (hasRefundExchangeSignal(customerMessage)) {
    decision = {
      ...decision,
      handlingType: "needs_approval",
      riskLevel: decision.riskLevel === "high" ? "high" : "normal",
    };
  }

  if (unsupportedCommitmentPattern.test(decision.reply)) {
    return createValidationDecision({
      reply: buildSafeVerificationReply({ caseType, store }),
      handlingType:
        decision.handlingType === "needs_approval"
          ? "needs_approval"
          : "needs_review",
      riskLevel: decision.riskLevel === "high" ? "high" : "normal",
      reason:
        "생성된 초안에 확인되지 않은 보상 또는 재처리 약속이 포함되어 안전한 확인 답변으로 전환했습니다.",
    });
  }

  if (hasRepeatedFactRequest(customerMessage, decision.reply)) {
    return createValidationDecision({
      reply: buildSafeVerificationReply({ caseType, store }),
      handlingType:
        decision.handlingType === "needs_approval"
          ? "needs_approval"
          : "needs_review",
      riskLevel: decision.riskLevel === "high" ? "high" : "normal",
      reason:
        "고객이 이미 제공한 정보를 다시 요청하는 내용이 있어 현재 정보로 확인하는 답변으로 전환했습니다.",
    });
  }

  if (
    caseTypesRequiringVerification.has(caseType) &&
    !/(확인|알려|남겨|보내|문의|살펴|점검)/.test(decision.reply)
  ) {
    return createValidationDecision({
      reply: buildSafeVerificationReply({ caseType, store }),
      handlingType:
        decision.handlingType === "needs_approval"
          ? "needs_approval"
          : "needs_review",
      riskLevel: decision.riskLevel === "high" ? "high" : "normal",
      reason:
        "처리에 필요한 확인 단계가 답변에 없어 안전한 확인 답변으로 전환했습니다.",
    });
  }

  if (
    decision.handlingType === "auto_ready" &&
    verificationDeferralPattern.test(decision.reply)
  ) {
    return createValidationDecision({
      reply: decision.reply,
      reason:
        "초안이 추가 확인이 필요하다고 안내하고 있어 자동 완료하지 않고 확인 필요로 전환했습니다.",
    });
  }

  return decision;
}
