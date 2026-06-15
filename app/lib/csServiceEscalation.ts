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
  /다쳤|다침|상처|베였|베임|화상|피가\s*났|부상을?\s*(입|당)|넘어졌|미끄러졌|찔렸|아이[^\n]*(?:다쳤|상처|위험)/;
const repeatMarkerPattern =
  /지난번|전에도|이전에도|이번에도|또|다시|계속|반복|재발|두\s*번|세\s*번|몇\s*번|여러\s*번/;
const unresolvedIssuePattern =
  /고장|불량|문제(?![가은는]?\s*없)|누락|빠졌|지연|늦었|늦어|오배송|잘못|다르(?:게|다고|네요|습니다|아요|어요)|작동(?:이)?\s*안|작동하지\s*않|안\s*켜|반영(?:이|가)?\s*안|예약(?:이|이요)?\s*안|접수(?:가)?\s*안|처리(?:가)?\s*안|취소(?:가)?\s*안|변경(?:이|이요)?\s*안|배정(?:이)?\s*잘못|안\s*왔|오지\s*않|미방문/;
const priorRemedyPattern =
  /교환|교체|수리|재배송|다시\s*배송|재조리|다시\s*조리|재시술|다시\s*시술|재방문|보강|재예약|다시\s*처리/;
const serviceCommunicationBreakdownPattern =
  /(?:문의|톡|메시지|연락|요청|신청)[^\n]*(?:답변이?\s*없|회신이?\s*없|연락이?\s*안|읽고[^\n]*답|반영(?:이|가)?\s*안|접수(?:가)?\s*안|처리(?:가)?\s*안)/;
const serviceProcessBreakdownPattern =
  /(?:예약|주문|신청|접수|변경|취소|보강|배정|처리)[^\n]*(?:누락|안\s*됐|안\s*됨|반영(?:이|가)?\s*안|멈춰|진행(?:이)?\s*안)|(?:배달|배송|방문|픽업|수거|회수)[^\n]*(?:기사|담당자)?[^\n]*(?:안\s*왔|오지\s*않|미방문|누락)/;
const usedProductSuspicionPattern =
  /중고(?:품|제품)?[^\n]*(?:같|의심)|반품(?:품|상품|제품)[^\n]*(?:같|의심|재출고)|사용\s*흔적|개봉\s*흔적|밀봉[^\n]*(?:뜯|재부착|흔적)|포장[^\n]*머리카락|제품[^\n]*머리카락/;
const fulfillmentIssuePattern =
  /구성품[^\n]*(?:없|누락|빠졌|안\s*왔)|(?:소스|부품|사은품|메뉴|상품|옵션)[^\n]*(?:누락|빠졌|안\s*왔)|오배송|다른\s*(?:상품|메뉴|옵션|색상|사이즈|객실)[^\n]*(?:왔|배송|배정|제공)|수량[^\n]*(?:부족|모자|다름)|(?:주문|예약|요청|선택|신청)(?:한|했|드린)?[^\n]{0,80}(?:다르|잘못|반대|아니|누락|빠졌|반영(?:이|가)?\s*안)|(?:각인|문구|도안)[^\n]*(?:다르|잘못)[^\n]*(?:제작|왔)|(?:아이스|차갑게)[^\n]*(?:주문|요청)[^\n]*(?:뜨거운|핫)[^\n]*(?:왔|나왔|제공)|(?:뜨겁게|핫)[^\n]*(?:주문|요청)[^\n]*(?:차가운|아이스)[^\n]*(?:왔|나왔|제공)|(?:금연|흡연)[^\n]*객실[^\n]*(?:예약|요청)[^\n]*(?:반대|다른|잘못|흡연|금연)[^\n]*배정/;

function isRepeatFailure(text: string) {
  return (
    repeatMarkerPattern.test(text) &&
    (unresolvedIssuePattern.test(text) ||
      (priorRemedyPattern.test(text) && /안\s*되|실패|해결[^\n]*안/.test(text)))
  );
}

function isServiceBreakdown(text: string) {
  return (
    serviceCommunicationBreakdownPattern.test(text) ||
    serviceProcessBreakdownPattern.test(text)
  );
}

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

  if (isRepeatFailure(text)) {
    return {
      kind: "repeat_failure",
      riskLevel: "high",
      reason:
        "이전 문의나 조치 이후에도 같은 문제가 반복된 상황으로, 이전 처리 이력과 현재 상태를 확인한 뒤 답변해야 합니다.",
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

  if (isServiceBreakdown(text)) {
    return {
      kind: "service_breakdown",
      riskLevel: "normal",
      reason:
        "문의, 주문, 예약 또는 후속 처리 과정이 정상적으로 이어지지 않은 내용이 있어 현재 처리 상태 확인이 필요합니다.",
    };
  }

  if (fulfillmentIssuePattern.test(text)) {
    return {
      kind: "fulfillment_issue",
      riskLevel: "normal",
      reason:
        "주문·예약·요청 내용과 실제 제공 결과가 다를 가능성이 있어 원래 요청과 현재 상태 확인이 필요합니다.",
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
    "교환·수리·재배송뿐 아니라 재조리·재시술·재방문·보강·예약 재처리 후 같은 문제가 다시 발생했거나 여러 번 문의한 고객은 일반 문의로 처리하지 마세요. 이전 처리 이력까지 확인해야 하므로 needs_approval로 분류하세요.",
    "답변, 주문, 예약, 접수, 배달, 방문, 픽업, 수거 같은 고객 여정이 중간에 끊긴 경우 먼저 불편을 인정하고 현재 실제 처리 상태를 확인하세요.",
    "상품·메뉴·옵션·수량·객실·예약 시간·시술·수업·제작 결과가 주문·예약·요청과 다를 가능성이 있으면 원래 요청과 실제 제공 결과를 구분해 확인하고, 확인 전 보상이나 재처리를 약속하지 마세요.",
    "상품 판매 업종에서 사용 흔적, 개봉 흔적, 반품 상품 재출고 또는 중고 상품 의심은 출고·포장·검수 이력 확인이 필요한 신뢰 이슈이므로 needs_approval로 분류하세요.",
    "상품, 음식, 시설 또는 서비스 과정에서 고객이나 주변 사람이 다쳤거나 상처, 화상, 베임 등 부상이 언급되면 risk_level을 high로 판단하고 원인을 단정하지 마세요.",
  ].join("\n");
}
