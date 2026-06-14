export type CsServiceEscalationKind =
  | "customer_harm"
  | "repeat_failure"
  | "service_breakdown"
  | "used_product_suspicion"
  | "fulfillment_issue";

type CsServiceEscalation = {
  kind: CsServiceEscalationKind;
  riskLevel: "normal" | "high";
  reason: string;
};

const customerHarmPattern =
  /다쳤|다침|상처|베였|베임|화상|피가\s*났|부상을?\s*(입|당)|넘어졌|찔렸|아이[^\n]*(?:다쳤|상처|위험)/;
const repeatFailurePattern =
  /교환(?:받|했|한)[^\n]*(?:또|다시)[^\n]*(?:고장|불량|문제)|(?:또|다시)[^\n]*(?:고장|불량|문제)|재교환|반복(?:해서|적으로)?[^\n]*(?:고장|불량|문제)|계속[^\n]*(?:고장|불량|문제)|몇\s*번[^\n]*(?:고장|교환|수리|A\/?S)/i;
const serviceBreakdownPattern =
  /(?:문의|톡|메시지|연락)[^\n]*(?:답변이?\s*없|회신이?\s*없|연락이?\s*안|읽고[^\n]*답)|회수[^\n]*(?:누락|안\s*됐|안\s*됨|안\s*해|미방문)|기사[^\n]*(?:안\s*왔|미방문)|접수[^\n]*(?:누락|안\s*됐|안\s*됨)|처리[^\n]*(?:누락|안\s*됐|안\s*됨)/;
const usedProductSuspicionPattern =
  /중고(?:품|제품)?[^\n]*(?:같|의심)|반품(?:품|상품|제품)[^\n]*(?:같|의심|재출고)|사용\s*흔적|개봉\s*흔적|밀봉[^\n]*(?:뜯|재부착|흔적)|포장[^\n]*머리카락|제품[^\n]*머리카락/;
const fulfillmentIssuePattern =
  /구성품[^\n]*(?:없|누락|빠졌|안\s*왔)|(?:소스|부품|사은품|메뉴|상품)[^\n]*(?:누락|빠졌|안\s*왔)|오배송|다른\s*(?:상품|메뉴|색상|사이즈)[^\n]*(?:왔|배송)|수량[^\n]*(?:부족|모자|다름)/;

export function detectCsServiceEscalation(
  text: string,
): CsServiceEscalation | null {
  if (customerHarmPattern.test(text)) {
    return {
      kind: "customer_harm",
      riskLevel: "high",
      reason:
        "고객 또는 주변 사람의 부상 가능성이 언급되어 안전 확인과 사장님 승인이 필요합니다.",
    };
  }

  if (repeatFailurePattern.test(text)) {
    return {
      kind: "repeat_failure",
      riskLevel: "high",
      reason:
        "교환 또는 처리 후에도 문제가 반복된 상황으로, 이전 처리 이력까지 확인한 뒤 답변해야 합니다.",
    };
  }

  if (usedProductSuspicionPattern.test(text)) {
    return {
      kind: "used_product_suspicion",
      riskLevel: "high",
      reason:
        "사용 흔적이나 반품 상품 재출고 의심이 포함되어 있어 출고·검수 이력을 확인한 뒤 답변해야 합니다.",
    };
  }

  if (serviceBreakdownPattern.test(text)) {
    return {
      kind: "service_breakdown",
      riskLevel: "normal",
      reason:
        "답변, 접수 또는 회수 과정이 정상적으로 이어지지 않은 내용이 있어 현재 처리 상태 확인이 필요합니다.",
    };
  }

  if (fulfillmentIssuePattern.test(text)) {
    return {
      kind: "fulfillment_issue",
      riskLevel: "normal",
      reason:
        "오배송, 수량 차이 또는 구성품 누락 가능성이 있어 주문 내용과 수령 상태 확인이 필요합니다.",
    };
  }

  return null;
}

export function applyCsServiceEscalation<
  T extends {
    handlingType: "auto_ready" | "needs_review" | "needs_approval";
    riskLevel: "low" | "normal" | "high";
    aiReason?: string;
  },
>(text: string, decision: T): T {
  const escalation = detectCsServiceEscalation(text);
  if (!escalation) return decision;

  return {
    ...decision,
    handlingType: "needs_approval",
    riskLevel: escalation.riskLevel,
    aiReason: escalation.reason,
  };
}

export function buildCsServiceEscalationPrompt() {
  return [
    "[반복 문제와 서비스 실패 우선 처리]",
    "교환·수리·재배송 후 같은 문제가 다시 발생했거나 여러 번 문의한 고객은 일반 문의로 처리하지 마세요. 이전 처리 이력까지 확인해야 하므로 needs_approval로 분류하세요.",
    "답변 누락, 접수 누락, 회수 기사 미방문, 재회수, 처리 지연처럼 고객센터 절차가 끊긴 경우 먼저 불편을 인정하고 현재 실제 처리 상태를 확인하세요.",
    "오배송, 수량 차이, 구성품 누락은 주문 내용과 고객이 실제 수령한 내용을 구분해 확인하고, 확인 전 재배송이나 환불을 약속하지 마세요.",
    "사용 흔적, 개봉 흔적, 반품 상품 재출고 또는 중고 상품 의심은 출고·포장·검수 이력 확인이 필요한 신뢰 이슈이므로 needs_approval로 분류하세요.",
    "고객이나 주변 사람이 다쳤거나 상처, 화상, 베임 등 부상이 언급되면 risk_level을 high로 판단하고 원인을 단정하지 마세요.",
  ].join("\n");
}
