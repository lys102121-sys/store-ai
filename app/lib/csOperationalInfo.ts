import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

export type OperationalInfoTopic =
  | "pricing"
  | "stock"
  | "business_hours"
  | "shipping_schedule"
  | "reservation"
  | "refund_exchange"
  | "product_composition"
  | "shipping_fee";

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
