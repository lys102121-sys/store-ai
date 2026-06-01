import type { MissingOperationalInfo } from "@/app/lib/csOperationalInfo";
import type {
  CsReplyHandlingType,
  CsReplyRiskLevel,
} from "@/app/lib/csReplyGeneration";
import type {
  HandlingType,
  RiskLevel,
  Sentiment,
} from "@/app/lib/reviewReplyGeneration";

const healthSafetyPattern =
  /알레르기|알러지|두드러기|발진|붉어|복통|배가\s*아프|식중독|상한|이상\s*반응|호흡|병원|아프다|아파|먹고\s*탈|탈났|피부\s*반응|가려|위생/;
const disputePattern = /법적|신고|소송|분쟁|고소|소비자원|보상/;
const strongComplaintPattern = /최악|화나|불쾌|실망|강력|항의|클레임/;

const missingOperationalReason: Record<
  MissingOperationalInfo["topic"],
  string
> = {
  pricing:
    "가격 정보가 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  stock:
    "재고 정보가 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  business_hours:
    "영업시간 정보가 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  shipping_schedule:
    "출고 가능 여부와 기준 시간이 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  reservation:
    "예약 가능 여부와 기준이 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  refund_exchange:
    "환불 또는 교환 기준이 충분하지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  product_composition:
    "상품 수량 또는 종류 정보가 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
  shipping_fee:
    "배송비 정보가 등록되어 있지 않아 정확한 안내를 위해 사장님 확인이 필요합니다.",
};

export function buildCsAiReason({
  customerMessage,
  handlingType,
  riskLevel,
  missingOperationalInfo,
}: {
  customerMessage: string;
  handlingType: CsReplyHandlingType;
  riskLevel: CsReplyRiskLevel;
  missingOperationalInfo?: MissingOperationalInfo | null;
}) {
  if (missingOperationalInfo) {
    return missingOperationalReason[missingOperationalInfo.topic];
  }

  if (healthSafetyPattern.test(customerMessage)) {
    return "알레르기/건강/위생 관련 내용이 포함되어 있어 원인 단정 없이 사장님 확인이 필요합니다.";
  }

  if (disputePattern.test(customerMessage)) {
    return "법적 또는 분쟁 가능성이 있는 표현이 포함되어 있어 답변 전 사장님 확인이 필요합니다.";
  }

  if (/환불|반품|교환|취소/.test(customerMessage)) {
    return "환불 또는 교환 관련 문의로 정책과 주문 상태를 확인한 뒤 답변해야 합니다.";
  }

  if (strongComplaintPattern.test(customerMessage) || riskLevel === "high") {
    return "강한 불만 또는 위험 가능성이 있어 답변 전 사장님 확인이 필요합니다.";
  }

  if (handlingType === "needs_review") {
    return "정확한 답변에 필요한 상품 또는 정책 정보가 부족해 사장님 확인이 필요합니다.";
  }

  if (handlingType === "needs_approval") {
    return "고객 상황에 맞는 답변인지 확인이 필요한 문의로 승인 후 답변하는 것이 좋습니다.";
  }

  return "등록된 상품/정책 정보에 명확한 답이 있어 바로 답변 가능하다고 판단했습니다.";
}

export function buildReviewAiReason({
  review,
  sentiment,
  handlingType,
  riskLevel,
}: {
  review: string;
  sentiment: Sentiment;
  handlingType: HandlingType;
  riskLevel: RiskLevel;
}) {
  if (healthSafetyPattern.test(review)) {
    return "알레르기/건강/위생 관련 내용이 포함되어 있어 원인 단정 없이 사장님 확인이 필요합니다.";
  }

  if (disputePattern.test(review)) {
    return "법적 또는 분쟁 가능성이 있는 표현이 포함되어 있어 답글 등록 전 사장님 확인이 필요합니다.";
  }

  if (/환불|반품|교환|취소/.test(review)) {
    return "환불 또는 교환 요구가 포함되어 있어 답글 등록 전 사장님 확인이 필요합니다.";
  }

  if (/배송|배달|늦|지연/.test(review) && sentiment !== "positive") {
    return "배송 또는 배달 지연에 대한 아쉬움이 포함되어 있어 답글 등록 전 사장님 확인이 필요합니다.";
  }

  if (riskLevel === "high" || strongComplaintPattern.test(review)) {
    return "강한 불만 또는 위험 가능성이 있는 리뷰로 답글 등록 전 사장님 확인이 필요합니다.";
  }

  if (sentiment === "positive" && handlingType === "auto_ready") {
    return "단순 긍정 리뷰로 위험도가 낮아 바로 답변 가능하다고 판단했습니다.";
  }

  if (handlingType === "needs_review") {
    return "리뷰 맥락을 더 확인해야 자연스럽고 정확한 답글을 작성할 수 있습니다.";
  }

  if (handlingType === "needs_approval") {
    return "아쉬움이나 불만이 포함되어 있어 답글 등록 전 사장님 확인이 필요합니다.";
  }

  return "리뷰 내용이 일반적인 응대 범위에 있어 낮은 위험도로 판단했습니다.";
}
