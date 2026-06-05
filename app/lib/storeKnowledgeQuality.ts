export type StoreKnowledgeQualityItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  updated_at?: string | null;
};

export type StoreKnowledgeQuality = {
  isStale: boolean;
  ageDays: number | null;
  duplicateCount: number;
  conflictCount: number;
  relatedQuestions: string[];
};

export type StoreKnowledgeQualityReport = {
  byId: Record<string, StoreKnowledgeQuality>;
  summary: {
    totalCount: number;
    reviewCount: number;
    staleCount: number;
    duplicateCount: number;
    conflictCount: number;
  };
};

export const STORE_KNOWLEDGE_STALE_DAYS = 90;

const storeKnowledgeGenericTokens = new Set([
  "고객",
  "문의",
  "답변",
  "등록",
  "등록해주세요",
  "관련",
  "안내",
  "정보",
  "정확",
  "필요",
  "가능",
  "가능한가요",
  "여부",
  "궁금",
  "있나요",
  "되나요",
  "상품",
  "제품",
]);

const storeKnowledgeCategoryKeywords: Record<string, string[]> = {
  pricing: ["가격", "얼마", "금액", "비용", "몇원", "몇 원", "총액", "견적"],
  shipping: ["배송", "출고", "발송", "도착", "택배", "수령"],
  refund_exchange: ["환불", "취소", "반품", "교환"],
  stock: ["재고", "남아", "품절", "구매 가능", "주문 가능"],
  reservation: ["예약", "픽업", "방문 수령", "수령 시간"],
  packaging: [
    "포장",
    "선물 포장",
    "쇼핑백",
    "포장비",
    "포함",
    "동봉",
    "제공",
    "추가",
    "변경",
    "조절",
  ],
  allergy_ingredient: ["알레르기", "알러지", "성분", "원재료", "피부"],
  product: ["상품", "구성", "용량", "사이즈", "사용법", "보관"],
};

function normalizeStoreKnowledgeQualityText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function stripStoreKnowledgePostposition(value: string) {
  return value.replace(
    /(으로|에게|에서|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/g,
    "",
  );
}

function getStoreKnowledgeQualityTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .map((token) => stripStoreKnowledgePostposition(token.trim()))
    .filter(
      (token) =>
        token.length >= 2 && !storeKnowledgeGenericTokens.has(token),
    );
}

function hasStoreKnowledgeCategoryIntent(item: StoreKnowledgeQualityItem) {
  const keywords = storeKnowledgeCategoryKeywords[item.category] ?? [];
  const text = normalizeStoreKnowledgeQualityText(
    `${item.question}\n${item.answer}`,
  );

  return keywords.some((keyword) =>
    text.includes(normalizeStoreKnowledgeQualityText(keyword)),
  );
}

function areSimilarStoreKnowledgeQuestions(
  left: StoreKnowledgeQualityItem,
  right: StoreKnowledgeQualityItem,
) {
  if (left.category !== right.category) return false;

  const normalizedLeft = normalizeStoreKnowledgeQualityText(left.question);
  const normalizedRight = normalizeStoreKnowledgeQualityText(right.question);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (
    Math.min(normalizedLeft.length, normalizedRight.length) >= 8 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  ) {
    return true;
  }

  const leftTokens = getStoreKnowledgeQualityTokens(left.question);
  const rightTokens = getStoreKnowledgeQualityTokens(right.question);

  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const overlapCount = leftTokens.filter((leftToken) =>
    rightTokens.some(
      (rightToken) =>
        leftToken === rightToken ||
        (Math.min(leftToken.length, rightToken.length) >= 2 &&
          (leftToken.includes(rightToken) || rightToken.includes(leftToken))),
    ),
  ).length;

  if (
    overlapCount >= 1 &&
    hasStoreKnowledgeCategoryIntent(left) &&
    hasStoreKnowledgeCategoryIntent(right)
  ) {
    return true;
  }

  return overlapCount >= Math.min(2, leftTokens.length, rightTokens.length);
}

function getStoreKnowledgeAgeDays(updatedAt?: string | null) {
  if (!updatedAt) return null;

  const updatedAtTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedAtTime)) return null;

  return Math.floor((Date.now() - updatedAtTime) / (1000 * 60 * 60 * 24));
}

export function createEmptyStoreKnowledgeQuality(): StoreKnowledgeQuality {
  return {
    isStale: false,
    ageDays: null,
    duplicateCount: 0,
    conflictCount: 0,
    relatedQuestions: [],
  };
}

export function buildStoreKnowledgeQualityReport(
  items: StoreKnowledgeQualityItem[],
): StoreKnowledgeQualityReport {
  const byId = Object.fromEntries(
    items.map((item) => {
      const ageDays = getStoreKnowledgeAgeDays(item.updated_at);

      return [
        item.id,
        {
          ...createEmptyStoreKnowledgeQuality(),
          ageDays,
          isStale:
            typeof ageDays === "number" &&
            ageDays >= STORE_KNOWLEDGE_STALE_DAYS,
        },
      ];
    }),
  ) as Record<string, StoreKnowledgeQuality>;

  items.forEach((item, index) => {
    items.slice(index + 1).forEach((otherItem) => {
      if (!areSimilarStoreKnowledgeQuestions(item, otherItem)) return;

      const sameAnswer =
        normalizeStoreKnowledgeQualityText(item.answer) ===
        normalizeStoreKnowledgeQualityText(otherItem.answer);
      const itemQuality = byId[item.id];
      const otherQuality = byId[otherItem.id];

      if (!itemQuality || !otherQuality) return;

      if (sameAnswer) {
        itemQuality.duplicateCount += 1;
        otherQuality.duplicateCount += 1;
      } else {
        itemQuality.conflictCount += 1;
        otherQuality.conflictCount += 1;
        itemQuality.relatedQuestions.push(otherItem.question);
        otherQuality.relatedQuestions.push(item.question);
      }
    });
  });

  const qualities = Object.values(byId);

  return {
    byId,
    summary: {
      totalCount: items.length,
      reviewCount: qualities.filter(
        (quality) =>
          quality.isStale ||
          quality.duplicateCount > 0 ||
          quality.conflictCount > 0,
      ).length,
      staleCount: qualities.filter((quality) => quality.isStale).length,
      duplicateCount: qualities.filter((quality) => quality.duplicateCount > 0)
        .length,
      conflictCount: qualities.filter((quality) => quality.conflictCount > 0)
        .length,
    },
  };
}
