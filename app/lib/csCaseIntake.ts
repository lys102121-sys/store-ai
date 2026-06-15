export type CsCaseType =
  | "safety_harm"
  | "repeat_issue"
  | "service_breakdown"
  | "cancellation_refund"
  | "request_mismatch"
  | "quality_issue"
  | "progress_status"
  | "change_request"
  | "information_request";

type CsCaseIntake = {
  type: CsCaseType;
  label: string;
  requiredFacts: string[];
  guidance: string;
};

const caseDefinitions: Array<{
  type: Exclude<CsCaseType, "information_request">;
  label: string;
  pattern: RegExp;
  requiredFacts: string[];
  guidance: string;
}> = [
  {
    type: "safety_harm",
    label: "안전·건강 문제",
    pattern:
      /알레르기|알러지|두드러기|발진|복통|식중독|상한\s*것|이상\s*반응|호흡|병원|먹고\s*탈|피부\s*반응|가려|붉어|다쳤|상처|화상|베였|감전|연기|불꽃|과열|폭발|화재/,
    requiredFacts: [
      "관련 상품·음식·시설·서비스",
      "발생 시점과 현재 상태",
      "안전 확인에 꼭 필요한 최소 정보",
    ],
    guidance:
      "원인이나 책임을 단정하지 말고 안전을 먼저 안내하세요. 증상이 심하거나 지속되는 건강 문제는 의료기관 상담을 권장하고, 공개 답변에서는 개인정보나 상세 증상을 과도하게 요구하지 마세요.",
  },
  {
    type: "repeat_issue",
    label: "반복 문제",
    pattern:
      /(?:지난번|전에도|이전에도|이번에도|또|다시|계속|반복|재발|두\s*번|세\s*번|몇\s*번|여러\s*번)[^\n]*(?:고장|불량|문제|누락|빠졌|지연|늦|오배송|잘못|작동[^\n]*안|반영[^\n]*안|예약[^\n]*안|처리[^\n]*안|안\s*왔|미방문)/,
    requiredFacts: [
      "이전 문의나 조치 내용",
      "같은 문제가 다시 발생한 시점",
      "현재 해결되지 않은 상태",
    ],
    guidance:
      "처음 발생한 일반 문의처럼 답하지 말고 이전 조치와 현재 상태를 연결해 확인하세요. 확인 전 같은 조치를 다시 약속하지 마세요.",
  },
  {
    type: "service_breakdown",
    label: "처리 과정 중단",
    pattern:
      /(?:문의|톡|메시지|연락|요청|신청)[^\n]*(?:답변[^\n]*없|회신[^\n]*없|연락[^\n]*안|읽고[^\n]*답|반영[^\n]*안|접수[^\n]*안|처리[^\n]*안)|(?:배달|배송|방문|픽업|수거|회수)[^\n]*(?:안\s*왔|오지\s*않|미방문|누락)|(?:예약|주문|신청|접수|변경|취소|보강|배정|처리)[^\n]*(?:누락|멈춰|진행[^\n]*안)/,
    requiredFacts: [
      "고객이 앞서 요청한 내용과 시점",
      "현재 멈춘 처리 단계",
      "확인 가능한 주문·예약·접수 식별 정보",
    ],
    guidance:
      "고객이 이미 한 요청을 처음부터 반복하게 하지 말고, 현재 어느 단계에서 멈췄는지 확인하세요. 담당자나 플랫폼의 책임을 추측하지 마세요.",
  },
  {
    type: "cancellation_refund",
    label: "취소·환불·교환",
    pattern: /환불|취소|반품|교환|돈\s*돌려|결제\s*취소/,
    requiredFacts: [
      "대상 주문·예약·서비스",
      "요청 사유",
      "현재 제공·사용·배송·방문 상태",
    ],
    guidance:
      "등록된 정책과 현재 처리 상태를 구분해 확인하세요. 확인 전 환불 가능 여부, 금액, 회수, 재제공 또는 완료 시점을 확정하지 마세요.",
  },
  {
    type: "request_mismatch",
    label: "요청과 제공 결과 불일치",
    pattern:
      /오배송|누락|빠졌|안\s*왔|수량[^\n]*(?:부족|모자|다름)|다른\s*(?:상품|메뉴|옵션|색상|사이즈|객실)|(?:주문|예약|요청|선택|신청)(?:한|했|드린)?[^\n]{0,80}(?:다르|잘못|반대|아니|누락|빠졌|반영[^\n]*안)|각인[^\n]*(?:다르|잘못)|도안[^\n]*(?:다르|잘못)/,
    requiredFacts: [
      "고객이 원래 주문·예약·요청한 내용",
      "실제로 받은 상품·음식·서비스 결과",
      "차이를 확인할 수 있는 최소 정보",
    ],
    guidance:
      "원 요청과 실제 제공 결과를 분리해 확인하세요. 사진은 차이를 확인하는 데 실제로 도움이 될 때만 이유와 함께 요청하세요.",
  },
  {
    type: "quality_issue",
    label: "품질·작동·서비스 결과 문제",
    pattern:
      /고장|불량|파손|작동(?:하지\s*않|[^\n]*안)|전원[^\n]*안|충전[^\n]*안|맛[^\n]*(?:이상|없|짜|싱거|별로)|차갑|식었|냄새|변질|시술[^\n]*(?:이상|불만|아쉬)|수업[^\n]*(?:불만|아쉬)|청소[^\n]*(?:안|불만)|제작[^\n]*(?:불량|문제)/,
    requiredFacts: [
      "문제가 생긴 상품·음식·서비스",
      "구체적인 증상이나 기대와 다른 점",
      "발생 또는 확인 시점",
    ],
    guidance:
      "고객이 느낀 문제를 구체적으로 인정하되 원인, 불량 여부, 고객 과실을 단정하지 마세요. 진단에 필요한 정보만 순서대로 요청하세요.",
  },
  {
    type: "progress_status",
    label: "진행 상태 문의",
    pattern:
      /언제\s*(?:오|도착|받|되|끝|출고|발송|배송|배달)|어디쯤|진행\s*상태|처리\s*상태|배송\s*조회|배달\s*상태|출고\s*됐|발송\s*됐|예약\s*확정|접수\s*됐|입금\s*확인|결제\s*확인/,
    requiredFacts: [
      "조회할 주문·예약·접수 식별 정보",
      "고객이 알고 싶은 현재 단계",
    ],
    guidance:
      "실시간 조회 근거가 없다면 완료, 출고, 입금, 예약 확정 상태를 만들지 말고 확인 후 안내하겠다고 답하세요.",
  },
  {
    type: "change_request",
    label: "주문·예약 변경",
    pattern:
      /(?:주문|예약|옵션|수량|주소|시간|날짜|메뉴|사이즈|색상|문구|도안)[^\n]*(?:변경|바꾸|수정)|(?:변경|바꾸|수정)[^\n]*(?:가능|되나요|돼요|하고\s*싶)/,
    requiredFacts: [
      "변경할 주문·예약·요청",
      "기존 내용과 원하는 변경 내용",
      "현재 준비·제작·배송·서비스 진행 단계",
    ],
    guidance:
      "변경 가능 여부는 등록 정책과 현재 진행 단계가 확인된 경우에만 안내하세요. 고객이 이미 말한 변경 내용을 다시 묻지 마세요.",
  },
];

const informationRequest: CsCaseIntake = {
  type: "information_request",
  label: "정보 문의",
  requiredFacts: ["질문 대상", "답변 근거가 되는 등록 정보"],
  guidance:
    "등록된 가게 지식에 명확한 답이 있으면 결론부터 짧게 답하세요. 근거가 없으면 추측하지 말고 확인이 필요하다고 안내하세요.",
};

export function classifyCsCase(message: string): CsCaseIntake {
  const normalizedMessage = message.replace(/\s+/g, " ").trim();
  const definition = caseDefinitions.find(({ pattern }) =>
    pattern.test(normalizedMessage),
  );

  return definition ?? informationRequest;
}

export function buildCsCaseIntakePrompt(message: string) {
  const intake = classifyCsCase(message);

  return [
    "[현재 문의 처리 체크리스트]",
    `문의 유형: ${intake.label}`,
    `필요한 사실: ${intake.requiredFacts.join(", ")}`,
    intake.guidance,
    "고객이 문의에서 이미 말한 정보는 다시 묻지 마세요.",
    "한 번에 긴 양식을 요구하지 말고, 지금 답변하거나 다음 처리 단계로 넘어가는 데 꼭 필요한 정보만 요청하세요.",
  ].join("\n");
}
