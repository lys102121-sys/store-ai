export type TargetField =
  | "product_details"
  | "product_caution"
  | "shipping_policy"
  | "refund_policy"
  | "extra_faq";

export type MissingInfoTopic =
  | "gift_wrapping"
  | "allergy"
  | "size_adjustment"
  | "care_instruction"
  | "material"
  | "product_composition"
  | "product_option"
  | "shipping_fee"
  | "shipping_schedule"
  | "refund_exchange"
  | "pricing"
  | "stock"
  | "business_hours"
  | "reservation"
  | "general";

export type MissingInfoRow = {
  id: string;
  question: string | null;
  source_message: string | null;
  source_messages: unknown;
  topic: string | null;
};

export type PendingCsMessageRow = {
  id: number | string;
  customer_message: string | null;
};

type InquiryIntentGroup = {
  id: string;
  keywords: string[];
  allowGeneralMatch: boolean;
};

export const allowedTargetFields: TargetField[] = [
  "product_details",
  "product_caution",
  "shipping_policy",
  "refund_policy",
  "extra_faq",
];

const inquiryIntentGroups: InquiryIntentGroup[] = [
  {
    id: "pricing",
    keywords: ["가격", "얼마", "금액", "비용", "몇 원", "몇원", "총액", "견적"],
    allowGeneralMatch: false,
  },
  {
    id: "shipping",
    keywords: [
      "배송",
      "출고",
      "발송",
      "오늘 보내",
      "언제 받아",
      "도착",
      "택배",
      "수령",
    ],
    allowGeneralMatch: true,
  },
  {
    id: "refund_cancel_exchange",
    keywords: [
      "환불",
      "취소",
      "반품",
      "교환",
      "돈 돌려",
      "환불 가능",
      "취소 가능",
    ],
    allowGeneralMatch: true,
  },
  {
    id: "stock",
    keywords: [
      "재고",
      "남아",
      "품절",
      "구매 가능",
      "주문 가능",
      "아직 있나요",
    ],
    allowGeneralMatch: false,
  },
  {
    id: "reservation_pickup",
    keywords: [
      "예약",
      "픽업",
      "방문 수령",
      "수령 시간",
      "몇 시",
      "언제 가지러",
    ],
    allowGeneralMatch: true,
  },
  {
    id: "packaging",
    keywords: [
      "포장",
      "선물 포장",
      "포장 가능",
      "쇼핑백",
      "포장비",
      "케이크 초",
      "생일초",
      "숫자초",
      "양초",
      "케이크 칼",
      "토퍼",
      "메시지 카드",
      "메세지 카드",
      "보냉팩",
      "아이스팩",
      "추가 옵션",
      "부가 옵션",
      "포함",
      "동봉",
      "제공",
      "증정",
      "같이 주",
      "함께 주",
      "챙겨 주",
      "넣어 주",
      "달아 주",
      "붙여 주",
      "변경",
      "조절",
      "선택",
      "각인",
      "커스텀",
      "맞춤",
    ],
    allowGeneralMatch: true,
  },
  {
    id: "allergy_ingredient",
    keywords: [
      "알레르기",
      "알러지",
      "성분",
      "원재료",
      "두드러기",
      "피부",
      "가려움",
    ],
    allowGeneralMatch: true,
  },
];

const genericCoreTokens = new Set([
  "고객",
  "문의",
  "답변",
  "등록",
  "등록해",
  "등록해주세요",
  "알려",
  "알려주세요",
  "관련",
  "세부",
  "안내",
  "정보",
  "정확",
  "필요",
  "부탁",
  "드려요",
  "드립니다",
  "가능",
  "가능한가요",
  "가능여부",
  "여부",
  "궁금",
  "궁금해요",
  "있나요",
  "되나요",
  "주시나요",
  "같이",
  "오늘",
  "언제",
  "아직",
  "상품",
  "제품",
]);

export function isTargetField(value: string): value is TargetField {
  return allowedTargetFields.includes(value as TargetField);
}

export function appendAdditionalInfo(currentValue: string | null, answer: string) {
  const trimmedCurrentValue = currentValue?.trim();

  return trimmedCurrentValue
    ? `${trimmedCurrentValue}\n추가 안내: ${answer}`
    : answer;
}

export function classifyMissingInfoTopic(text: string): MissingInfoTopic {
  if (/제주|도서산간|배송비|추가 배송비/.test(text)) {
    return "shipping_fee";
  }

  if (/가격|얼마|몇\s*원/.test(text)) {
    return "pricing";
  }

  if (/재고|남은\s*수량|품절|매진/.test(text)) {
    return "stock";
  }

  if (/영업|운영\s*시간|오픈|마감/.test(text)) {
    return "business_hours";
  }

  if (/예약/.test(text)) {
    return "reservation";
  }

  if (
    /케이크\s*초|생일\s*초|생일초|숫자\s*초|숫자초|양초|케이크\s*칼|토퍼|쇼핑백|메시지\s*카드|메세지\s*카드|보냉팩|아이스팩|추가\s*옵션|부가\s*옵션|포함(?:되나요|돼요|인가요)?|동봉(?:되나요|돼요|인가요)?|제공(?:되나요|돼요|인가요)?|증정(?:되나요|돼요|인가요)?|같이\s*(?:주|주시|오나요)|함께\s*(?:주|주시|오나요)|챙겨\s*주|넣어\s*주|달아\s*주|붙여\s*주|변경\s*(?:되나요|돼요|가능|할\s*수)|조절\s*(?:되나요|돼요|가능|할\s*수)|선택\s*(?:되나요|돼요|가능|할\s*수)|각인\s*(?:되나요|돼요|가능|할\s*수)|커스텀\s*(?:되나요|돼요|가능|할\s*수)|맞춤\s*(?:되나요|돼요|가능|할\s*수)/.test(
      text,
    )
  ) {
    return "product_option";
  }

  if (/선물|포장|선물포장|포장되나요|포장 가능|기프트/.test(text)) {
    return "gift_wrapping";
  }

  if (/알레르기|알러지|피부|금속 알레르기/.test(text)) {
    return "allergy";
  }

  if (/사이즈|조절|크기|호수/.test(text)) {
    return "size_adjustment";
  }

  if (/물|땀|향수|변색|보관|세척/.test(text)) {
    return "care_instruction";
  }

  if (/재질|소재|실버|은|금속/.test(text)) {
    return "material";
  }

  if (/구성|용량|몇 인분|수량/.test(text)) {
    return "product_composition";
  }

  if (/출고|배송일|언제 배송|발송/.test(text)) {
    return "shipping_schedule";
  }

  if (/환불|반품|교환/.test(text)) {
    return "refund_exchange";
  }

  return "general";
}

export function getMissingInfoTopic(missingInfo: MissingInfoRow) {
  const existingTopic = missingInfo.topic?.trim();

  if (existingTopic) {
    return existingTopic as MissingInfoTopic;
  }

  return classifyMissingInfoTopic(
    `${missingInfo.question ?? ""}\n${missingInfo.source_message ?? ""}`,
  );
}

export function normalizeSourceMessages(missingInfo: MissingInfoRow) {
  const messages = Array.isArray(missingInfo.source_messages)
    ? missingInfo.source_messages.filter(
        (message): message is string => typeof message === "string",
      )
    : [];

  if (
    missingInfo.source_message &&
    !messages.includes(missingInfo.source_message)
  ) {
    messages.unshift(missingInfo.source_message);
  }

  return messages;
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function getComparableTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function stripKoreanPostposition(value: string) {
  return value.replace(/(으로|에게|에서|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/g, "");
}

function getIntentMatches(value: string) {
  const normalizedValue = normalizeKeyword(value);

  return inquiryIntentGroups
    .map((group) => ({
      group,
      keywords: group.keywords.filter((keyword) =>
        normalizedValue.includes(normalizeKeyword(keyword)),
      ),
    }))
    .filter((match) => match.keywords.length > 0);
}

function getCoreTokens(value: string) {
  const intentKeywords = inquiryIntentGroups.flatMap((group) => group.keywords);

  return new Set(
    value
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map((token) => stripKoreanPostposition(token.trim()))
      .filter((token) => {
        if (token.length < 2) return false;
        if (genericCoreTokens.has(token)) return false;

        return !intentKeywords.some((keyword) => {
          const normalizedKeyword = normalizeKeyword(keyword);
          const normalizedToken = normalizeKeyword(token);

          return (
            normalizedToken === normalizedKeyword ||
            normalizedToken.includes(normalizedKeyword)
          );
        });
      }),
  );
}

function hasCoreTokenOverlap(left: string, right: string) {
  const leftTokens = [...getCoreTokens(left)];
  const rightTokens = [...getCoreTokens(right)];

  return leftTokens.some((leftToken) =>
    rightTokens.some(
      (rightToken) =>
        leftToken === rightToken ||
        (Math.min(leftToken.length, rightToken.length) >= 2 &&
          (leftToken.includes(rightToken) || rightToken.includes(leftToken))),
    ),
  );
}

function isVeryShortGeneralQuestion(value: string) {
  const normalizedValue = normalizeComparableText(value);

  return normalizedValue.length <= 5 && getCoreTokens(value).size === 0;
}

function hasIntentKeywordMatch(candidate: string, reference: string) {
  const candidateMatches = getIntentMatches(candidate);
  const referenceMatches = getIntentMatches(reference);

  return candidateMatches.some((candidateMatch) => {
    const referenceMatch = referenceMatches.find(
      (match) => match.group.id === candidateMatch.group.id,
    );

    if (!referenceMatch) return false;

    if (hasCoreTokenOverlap(candidate, reference)) {
      return true;
    }

    if (candidateMatch.group.allowGeneralMatch) {
      return !(
        isVeryShortGeneralQuestion(candidate) ||
        isVeryShortGeneralQuestion(reference)
      );
    }

    return false;
  });
}

export function isSimilarMessage(candidate: string, references: string[]) {
  const normalizedCandidate = normalizeComparableText(candidate);
  const candidateTokens = getComparableTokens(candidate);

  return references.some((reference) => {
    const normalizedReference = normalizeComparableText(reference);

    if (
      normalizedCandidate === normalizedReference ||
      (Math.min(normalizedCandidate.length, normalizedReference.length) >= 8 &&
        (normalizedCandidate.includes(normalizedReference) ||
          normalizedReference.includes(normalizedCandidate)))
    ) {
      return true;
    }

    if (hasIntentKeywordMatch(candidate, reference)) {
      return true;
    }

    const referenceTokens = getComparableTokens(reference);
    const overlapCount = [...candidateTokens].filter((token) =>
      referenceTokens.has(token),
    ).length;

    return (
      overlapCount >= 2 ||
      (overlapCount === 1 &&
        Math.min(candidateTokens.size, referenceTokens.size) === 1)
    );
  });
}

export function findRelatedCsMessages(
  messages: PendingCsMessageRow[],
  referenceMessages: string[],
) {
  return messages.filter(
    (message) =>
      message.customer_message &&
      isSimilarMessage(message.customer_message, referenceMessages),
  );
}
