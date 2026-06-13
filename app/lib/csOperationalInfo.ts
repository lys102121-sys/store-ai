import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

export type OperationalInfoTopic =
  | "pricing"
  | "stock"
  | "business_hours"
  | "shipping_schedule"
  | "reservation"
  | "refund_exchange"
  | "product_composition"
  | "product_option"
  | "shipping_fee"
  | "service_intake";

export type MissingOperationalInfo = {
  topic: OperationalInfoTopic;
  question: string;
  reason: string;
  fallbackReply: string;
};

type OperationalInfoGuard = {
  reply: string;
  handlingType: "needs_review";
  riskLevel: "normal";
  missingInfo: MissingOperationalInfo | null;
};

const wonAmountPattern = /(\d[\d,]*(?:\.\d+)?)\s*(만원|천원|원)/g;

function joinStoreText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}

function getProductOperationalText(store: CsReplyPromptStore) {
  return joinStoreText([
    store.product_name,
    store.product_description,
    store.product_details,
    store.product_catalog,
    store.extra_faq,
  ]);
}

function getGeneralOperationalText(store: CsReplyPromptStore) {
  return joinStoreText([
    store.shipping_policy,
    store.refund_policy,
    store.product_name,
    store.product_description,
    store.product_details,
    store.product_caution,
    store.product_catalog,
    store.extra_faq,
  ]);
}

function getGreeting(store: CsReplyPromptStore) {
  const storeName = store.store_name?.trim();

  return storeName ? `안녕하세요, ${storeName}입니다.` : "안녕하세요.";
}

function normalizeProductSubject(customerMessage: string) {
  const subject = customerMessage
    .replace(
      /가격(?:이|은|는)?\s*(?:어떻게\s*되나요|얼마인가요|얼마예요|얼마죠|문의드립니다|알려주세요)?/g,
      "",
    )
    .replace(/얼마(?:인가요|예요|죠|인지|입니까|에요)?/g, "")
    .replace(/몇\s*원(?:인가요|예요|인지|입니까)?/g, "")
    .replace(/[?!.。！？]/g, "")
    .trim()
    .replace(/\s*(?:은|는|이|가|요)$/g, "")
    .trim();

  return subject || "상품";
}

function createFallbackReply(
  store: CsReplyPromptStore,
  subject: string,
  informationLabel: string,
) {
  return `${getGreeting(store)} ${subject} ${informationLabel}은 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.`;
}

function parseWonAmounts(text: string) {
  return [...text.matchAll(wonAmountPattern)].map((match) => {
    const numericValue = Number(match[1].replaceAll(",", ""));
    const multiplier =
      match[2] === "만원" ? 10_000 : match[2] === "천원" ? 1_000 : 1;

    return numericValue * multiplier;
  });
}

function hasExplicitPriceInfo(store: CsReplyPromptStore) {
  const text = getProductOperationalText(store);

  // Keep this check server-side so a model cannot invent a price absent from store knowledge.
  return parseWonAmounts(text).length > 0 || /(?:가격|금액)\s*[:：]?\s*무료/.test(text);
}

function hasExplicitShippingFeeInfo(store: CsReplyPromptStore) {
  const text = joinStoreText([store.shipping_policy, store.extra_faq]);

  return (
    /(?:배송비|택배비|추가\s*배송비)[^\n]*(?:\d[\d,]*(?:\.\d+)?\s*(?:만원|천원|원)|무료)/.test(
      text,
    ) || /무료\s*배송|배송비\s*무료/.test(text)
  );
}

function hasExplicitStockInfo(store: CsReplyPromptStore) {
  return /(?:재고|남은\s*수량|판매\s*가능\s*수량)\s*[:：]?\s*(?:있음|없음|보유|\d+)|품절|매진|재고\s*소진/.test(
    getGeneralOperationalText(store),
  );
}

function hasExplicitQuantityInfo(store: CsReplyPromptStore) {
  return /\d+\s*(?:개|종|종류|인분|세트|묶음|팩|호|ml|mL|g|kg)/.test(
    getProductOperationalText(store),
  );
}

function hasExplicitBusinessHoursInfo(store: CsReplyPromptStore) {
  return /(?:영업\s*시간|운영\s*시간|오픈|마감|영업).*?(?:오전|오후|\d{1,2}\s*시|휴무)/.test(
    getGeneralOperationalText(store),
  );
}

function hasExplicitShippingScheduleInfo(store: CsReplyPromptStore) {
  return /(?:당일|오늘).*?(?:출고|발송|배송)|(?:출고|발송|배송).*?(?:당일|오늘)|(?:출고|발송|배송).*?\d+\s*(?:영업일|일)|(?:오전|오후|\d{1,2}\s*시).*?(?:이전|까지).*?(?:출고|발송|배송)|(?:출고|발송|배송).*?(?:오전|오후|\d{1,2}\s*시)/.test(
    joinStoreText([store.shipping_policy, store.product_catalog, store.extra_faq]),
  );
}

function hasExplicitReservationInfo(store: CsReplyPromptStore) {
  return /예약.*?(?:가능|불가|필요|마감|이전|까지|\d+\s*일)|(?:가능|불가).*?예약/.test(
    getGeneralOperationalText(store),
  );
}

function hasExplicitRefundInfo(store: CsReplyPromptStore) {
  return /(?:환불|반품|교환|취소).*?(?:가능|불가|어렵|제한|기준|조건|기한|이내)/.test(
    store.refund_policy?.trim() ?? "",
  );
}

function hasExplicitServiceIntakeInfo(store: CsReplyPromptStore) {
  return /(?:A\/S|AS|수리|고장|불량|파손|누락|점검|교환)[\s\S]{0,160}?(?:접수|절차|방법|사진|영상|증상|상품명|모델명|구매일|주문\s*정보|확인)/i.test(
    joinStoreText([
      store.refund_policy,
      store.product_caution,
      store.product_catalog,
      store.extra_faq,
    ]),
  );
}

function isServiceIntakeQuestion(customerMessage: string) {
  return /고장|불량|파손|깨졌|망가|작동(?:이)?\s*(?:안|않)|전원[^\n]*(?:안|않)|충전[^\n]*(?:안|않)|오류|이상\s*작동|소음|구성품[^\n]*(?:누락|없)|(?:누락|빠져)[^\n]*구성품/.test(
    customerMessage,
  );
}

function createServiceIntakeFallbackReply(store: CsReplyPromptStore) {
  return `${getGreeting(store)} 이용에 불편을 드려 죄송합니다. 정확한 확인을 위해 상품명과 문제가 발생한 내용을 알려주시고, 가능하면 현재 상태를 확인할 수 있는 사진이나 영상을 보내주세요. 확인 후 처리 방법을 안내드리겠습니다.`;
}

const productOptionQuestionPattern =
  /케이크\s*초|생일\s*초|생일초|숫자\s*초|숫자초|양초|(?:^|[\s,?!.])초(?:는|도|를|가)?\s*(?:같이|함께|주|주시|제공|포함)|케이크\s*칼|(?:^|[\s,?!.])칼(?:은|도|을|이)?\s*(?:같이|함께|주|주시|제공|포함)|토퍼|쇼핑백|메시지\s*카드|메세지\s*카드|보냉팩|아이스팩|추가\s*옵션|부가\s*옵션|포함(?:되나요|돼요|인가요)?|동봉(?:되나요|돼요|인가요)?|제공(?:되나요|돼요|인가요)?|증정(?:되나요|돼요|인가요)?|같이\s*(?:주|주시|오나요)|함께\s*(?:주|주시|오나요)|챙겨\s*주|넣어\s*주|달아\s*주|붙여\s*주|변경\s*(?:되나요|돼요|가능|할\s*수)|조절\s*(?:되나요|돼요|가능|할\s*수)|선택\s*(?:되나요|돼요|가능|할\s*수)|각인\s*(?:되나요|돼요|가능|할\s*수)|커스텀\s*(?:되나요|돼요|가능|할\s*수)|맞춤\s*(?:되나요|돼요|가능|할\s*수)/;

const optionDecisionPattern =
  /가능|불가|제공|미제공|포함|미포함|별도|요청사항|추가|무료|유료|동봉|증정|준비|없음|있음|변경|조절|선택|각인|커스텀|맞춤/;

const genericOptionSubjectPatterns = [
  /(.{1,40}?)(?:은|는|이|가|도|을|를)?\s*(?:포함|동봉|제공|증정)(?:되나요|돼요|인가요|되나|됩니까)?/,
  /(.{1,40}?)(?:은|는|이|가|도|을|를)?\s*(?:같이|함께)\s*(?:주|주시|오나요|오나|제공)/,
  /(.{1,40}?)(?:은|는|이|가|도|을|를)?\s*(?:챙겨|넣어|달아|붙여)\s*주/,
  /(.{1,40}?)(?:은|는|이|가|도|을|를)?\s*(?:추가|변경|조절|선택|각인|커스텀|맞춤)\s*(?:되나요|돼요|가능|할\s*수)/,
  /(.{1,40}?)(?:은|는|이|가|도|을|를)?\s*가능(?:한가요|한지|할까요|합니까|한가|해요)/,
];

const genericOptionSubjectStopWords = new Set([
  "문의",
  "고객",
  "상품",
  "제품",
  "메뉴",
  "주문",
  "가능",
  "포함",
  "동봉",
  "제공",
  "증정",
  "같이",
  "함께",
  "주시나요",
  "주나요",
  "되나요",
  "돼요",
  "있나요",
  "부탁",
  "드려요",
]);

function isProductOptionQuestion(customerMessage: string) {
  return (
    productOptionQuestionPattern.test(customerMessage) ||
    Boolean(getGenericProductOptionSubject(customerMessage))
  );
}

function normalizeOptionSubject(subject: string) {
  return subject
    .replace(/[?!.。！？]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(혹시|혹시요|문의드립니다|문의드려요)\s*/, "")
    .replace(/\s*(?:은|는|이|가|도|을|를|요)$/g, "")
    .trim();
}

function getGenericProductOptionSubject(customerMessage: string) {
  for (const pattern of genericOptionSubjectPatterns) {
    const match = customerMessage.match(pattern);
    const subject = normalizeOptionSubject(match?.[1] ?? "");

    if (subject.length >= 2) return subject;
  }

  return "";
}

function getSubjectTokens(subject: string) {
  return subject
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .map((token) =>
      token
        .trim()
        .replace(/(으로|에게|에서|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/g, ""),
    )
    .filter(
      (token) =>
        token.length >= 2 && !genericOptionSubjectStopWords.has(token),
    );
}

function getProductOptionInfoPatternForQuestion(
  customerMessage: string,
): RegExp | null {
  if (/케이크\s*초|생일\s*초|생일초|숫자\s*초|숫자초|양초|(?:^|[\s,?!.])초(?:는|도|를|가)?\s*(?:같이|함께|주|주시|제공|포함)/.test(customerMessage)) {
    return /케이크\s*초|생일\s*초|생일초|숫자\s*초|숫자초|양초/;
  }

  if (/케이크\s*칼|(?:^|[\s,?!.])칼(?:은|도|을|이)?\s*(?:같이|함께|주|주시|제공|포함)/.test(customerMessage)) {
    return /케이크\s*칼/;
  }

  if (/토퍼/.test(customerMessage)) return /토퍼/;
  if (/쇼핑백/.test(customerMessage)) return /쇼핑백/;
  if (/메시지\s*카드|메세지\s*카드/.test(customerMessage)) {
    return /메시지\s*카드|메세지\s*카드/;
  }
  if (/보냉팩|아이스팩/.test(customerMessage)) return /보냉팩|아이스팩/;

  if (/추가\s*옵션|부가\s*옵션/.test(customerMessage)) {
    return /추가\s*옵션|부가\s*옵션/;
  }

  return null;
}

function hasExplicitProductOptionInfo(
  customerMessage: string,
  store: CsReplyPromptStore,
) {
  const text = getProductOperationalText(store);
  const optionPattern = getProductOptionInfoPatternForQuestion(customerMessage);
  const explicitKnownOptionInfo = optionPattern?.test(text) ?? false;
  const genericSubject = getGenericProductOptionSubject(customerMessage);
  const subjectTokens = getSubjectTokens(genericSubject);
  const hasSubjectEvidence =
    subjectTokens.length > 0 &&
    subjectTokens.every((token) => text.toLowerCase().includes(token));

  return (
    (explicitKnownOptionInfo || hasSubjectEvidence) &&
    optionDecisionPattern.test(text)
  );
}

function getProductOptionSubject(customerMessage: string) {
  if (/케이크\s*초|생일\s*초|생일초|숫자\s*초|숫자초|양초|(?:^|[\s,?!.])초(?:는|도|를|가)?\s*(?:같이|함께|주|주시|제공|포함)/.test(customerMessage)) {
    return "케이크 초 제공 여부";
  }

  if (/케이크\s*칼|(?:^|[\s,?!.])칼(?:은|도|을|이)?\s*(?:같이|함께|주|주시|제공|포함)/.test(customerMessage)) {
    return "케이크 칼 제공 여부";
  }

  if (/토퍼/.test(customerMessage)) return "토퍼 제공 여부";
  if (/쇼핑백/.test(customerMessage)) return "쇼핑백 제공 여부";
  if (/메시지\s*카드|메세지\s*카드/.test(customerMessage)) {
    return "메시지 카드 제공 여부";
  }
  if (/보냉팩|아이스팩/.test(customerMessage)) {
    return "보냉팩 또는 아이스팩 제공 여부";
  }
  if (/각인/.test(customerMessage)) return "각인 가능 여부";
  if (/커스텀/.test(customerMessage)) return "커스텀 가능 여부";
  if (/맞춤/.test(customerMessage)) return "맞춤 가능 여부";

  const genericSubject = getGenericProductOptionSubject(customerMessage);
  if (genericSubject) {
    if (/포함|동봉/.test(customerMessage)) {
      return `${genericSubject} 포함 여부`;
    }

    if (/제공|증정|같이|함께|챙겨|넣어|달아|붙여/.test(customerMessage)) {
      return `${genericSubject} 제공 여부`;
    }

    if (/추가/.test(customerMessage)) return `${genericSubject} 추가 가능 여부`;
    if (/변경/.test(customerMessage)) return `${genericSubject} 변경 가능 여부`;
    if (/조절/.test(customerMessage)) return `${genericSubject} 조절 가능 여부`;
    if (/선택/.test(customerMessage)) return `${genericSubject} 선택 가능 여부`;
    if (/각인/.test(customerMessage)) return `${genericSubject} 가능 여부`;
    if (/커스텀|맞춤/.test(customerMessage)) {
      return `${genericSubject} 가능 여부`;
    }

    return `${genericSubject} 가능 여부`;
  }

  return "부가 옵션 제공 여부";
}

function createProductOptionFallbackReply(
  store: CsReplyPromptStore,
  subject: string,
) {
  return `${getGreeting(store)} ${subject}는 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.`;
}

function getMissingPriceInfo(
  customerMessage: string,
  store: CsReplyPromptStore,
) {
  if (!/(?:가격|얼마|몇\s*원)/.test(customerMessage)) return null;
  if (/(?:배송비|택배비|추가\s*배송비)/.test(customerMessage)) return null;
  if (hasExplicitPriceInfo(store)) return null;

  const subject = normalizeProductSubject(customerMessage);

  return {
    topic: "pricing" as const,
    question: `${subject} 가격을 등록해주세요.`,
    reason: "가격 문의는 고객 구매 결정에 직접 관련되어 정확한 정보가 필요합니다.",
    fallbackReply: createFallbackReply(store, subject, "가격"),
  };
}

export function findMissingOperationalInfo(
  customerMessage: string,
  store: CsReplyPromptStore,
): MissingOperationalInfo | null {
  const missingPriceInfo = getMissingPriceInfo(customerMessage, store);
  if (missingPriceInfo) return missingPriceInfo;

  if (
    isServiceIntakeQuestion(customerMessage) &&
    !hasExplicitServiceIntakeInfo(store)
  ) {
    return {
      topic: "service_intake",
      question: "고장, 불량 또는 누락 문의의 확인 및 접수 절차를 등록해주세요.",
      reason:
        "원인이나 불량 여부를 단정하지 않고 상품과 증상, 필요한 사진 또는 영상을 확인할 절차가 필요합니다.",
      fallbackReply: createServiceIntakeFallbackReply(store),
    };
  }

  if (
    /(?:배송비|택배비|추가\s*배송비).*(?:얼마|가격|몇\s*원)|(?:얼마|가격|몇\s*원).*?(?:배송비|택배비|추가\s*배송비)/.test(
      customerMessage,
    ) &&
    !hasExplicitShippingFeeInfo(store)
  ) {
    return {
      topic: "shipping_fee",
      question: "배송비 정보를 등록해주세요.",
      reason: "배송비 문의는 정확한 금액 안내가 필요합니다.",
      fallbackReply: createFallbackReply(store, "배송비", "정보"),
    };
  }

  if (
    /재고|남아\s*있|몇\s*개\s*(?:있|남)/.test(customerMessage) &&
    !hasExplicitStockInfo(store)
  ) {
    return {
      topic: "stock",
      question: "상품 재고 정보를 등록해주세요.",
      reason: "재고 문의는 현재 판매 가능 수량에 대한 정확한 정보가 필요합니다.",
      fallbackReply: createFallbackReply(store, "재고", "정보"),
    };
  }

  if (
    /영업|몇\s*시.*?(?:까지|부터)|오픈|마감|운영\s*시간/.test(
      customerMessage,
    ) &&
    !hasExplicitBusinessHoursInfo(store)
  ) {
    return {
      topic: "business_hours",
      question: "영업시간을 등록해주세요.",
      reason: "영업시간 문의는 정확한 운영 시간 정보가 필요합니다.",
      fallbackReply: createFallbackReply(store, "영업시간", "정보"),
    };
  }

  if (
    /(?:오늘|당일).*?(?:출고|발송|배송)|(?:출고|발송|배송).*?(?:가능|되나요|돼요|언제)/.test(
      customerMessage,
    ) &&
    !hasExplicitShippingScheduleInfo(store)
  ) {
    return {
      topic: "shipping_schedule",
      question: "출고 가능 여부와 기준 시간을 등록해주세요.",
      reason: "출고 문의는 정확한 출고 가능 여부와 기준 시간이 필요합니다.",
      fallbackReply: createFallbackReply(store, "출고 가능 여부", "정보"),
    };
  }

  if (
    /예약.*?(?:가능|되나요|돼요|받나요|할\s*수)/.test(customerMessage) &&
    !hasExplicitReservationInfo(store)
  ) {
    return {
      topic: "reservation",
      question: "예약 가능 여부와 기준을 등록해주세요.",
      reason: "예약 문의는 정확한 예약 가능 여부와 기준이 필요합니다.",
      fallbackReply: createFallbackReply(store, "예약 가능 여부", "정보"),
    };
  }

  if (
    /(?:환불|반품|교환|취소).*?(?:가능|되나요|돼요|할\s*수)/.test(
      customerMessage,
    ) &&
    !hasExplicitRefundInfo(store)
  ) {
    return {
      topic: "refund_exchange",
      question: "환불, 교환, 취소 관련 기준을 등록해주세요.",
      reason: "환불이나 교환 문의는 정확한 정책 기준이 필요합니다.",
      fallbackReply: createFallbackReply(store, "환불 가능 여부", "정보"),
    };
  }

  if (
    isProductOptionQuestion(customerMessage) &&
    !hasExplicitProductOptionInfo(customerMessage, store)
  ) {
    const subject = getProductOptionSubject(customerMessage);

    return {
      topic: "product_option",
      question: `${subject}를 등록해주세요.`,
      reason:
        "포함, 제공, 동봉, 추가, 변경, 조절 같은 운영 옵션은 등록된 정보가 없으면 가능 여부를 단정할 수 없습니다.",
      fallbackReply: createProductOptionFallbackReply(store, subject),
    };
  }

  if (
    /몇\s*(?:개|종류|종|인분|세트)/.test(customerMessage) &&
    !hasExplicitQuantityInfo(store)
  ) {
    return {
      topic: "product_composition",
      question: "상품 수량 또는 종류 정보를 등록해주세요.",
      reason: "상품 수량이나 종류 문의는 정확한 구성 정보가 필요합니다.",
      fallbackReply: createFallbackReply(store, "상품 구성", "정보"),
    };
  }

  return null;
}

function hasUnsupportedPriceClaim(
  customerMessage: string,
  reply: string,
  store: CsReplyPromptStore,
) {
  if (!/(?:가격|얼마|몇\s*원)/.test(customerMessage)) return false;
  if (/(?:배송비|택배비|추가\s*배송비)/.test(customerMessage)) return false;

  const registeredAmounts = new Set(
    parseWonAmounts(getProductOperationalText(store)),
  );
  const replyAmounts = parseWonAmounts(reply);

  return replyAmounts.some((amount) => !registeredAmounts.has(amount));
}

export function applyOperationalInfoGuard({
  customerMessage,
  reply,
  store,
}: {
  customerMessage: string;
  reply: string;
  store: CsReplyPromptStore;
}): OperationalInfoGuard | null {
  const missingInfo = findMissingOperationalInfo(customerMessage, store);

  if (missingInfo) {
    return {
      reply: missingInfo.fallbackReply,
      handlingType: "needs_review",
      riskLevel: "normal",
      missingInfo,
    };
  }

  if (hasUnsupportedPriceClaim(customerMessage, reply, store)) {
    const subject = normalizeProductSubject(customerMessage);

    return {
      reply: createFallbackReply(store, subject, "가격"),
      handlingType: "needs_review",
      riskLevel: "normal",
      missingInfo: null,
    };
  }

  return null;
}
