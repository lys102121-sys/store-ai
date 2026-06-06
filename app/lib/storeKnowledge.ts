import type { SupabaseClient } from "@supabase/supabase-js";

import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";
import { buildStoreKnowledgeQualityReport } from "@/app/lib/storeKnowledgeQuality";

export type StoreKnowledgeCategory =
  | "pricing"
  | "shipping"
  | "refund_exchange"
  | "stock"
  | "reservation"
  | "packaging"
  | "allergy_ingredient"
  | "product"
  | "general";

export type StoreKnowledgeItem = {
  id?: string;
  user_id: string;
  store_id?: string | null;
  category: StoreKnowledgeCategory | string;
  question: string;
  answer: string;
  source_type: string;
  source_id?: string | null;
  source_text?: string | null;
  confidence: string;
  status?: StoreKnowledgeStatus | string | null;
  created_at?: string;
  updated_at?: string;
};

export type StoreKnowledgeStatus = "active" | "needs_review" | "archived";

export type UsedStoreKnowledgeItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

type StoreKnowledgeSaveInput = {
  supabase: SupabaseClient;
  userId: string;
  storeId: number | string;
  category: StoreKnowledgeCategory | string;
  question: string;
  answer: string;
  sourceId?: string | null;
  sourceText?: string | null;
};

type StoreKnowledgeLoadInput = {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
};

export const storeKnowledgeSql = `
create table if not exists store_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  store_id text,
  category text not null default 'general',
  question text not null,
  answer text not null,
  source_type text not null default 'missing_info',
  source_id text,
  source_text text,
  confidence text not null default 'owner_confirmed',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_knowledge_items_user_id_updated_at_idx
  on store_knowledge_items (user_id, updated_at desc);

create index if not exists store_knowledge_items_user_id_category_idx
  on store_knowledge_items (user_id, category);
`;

export const usedKnowledgeItemsSql =
  "alter table cs_messages add column if not exists used_knowledge_items jsonb default '[]'::jsonb;";

export const storeKnowledgeStatusSql =
  "alter table store_knowledge_items add column if not exists status text not null default 'active';";

function isMissingStoreKnowledgeTableError(error: { message: string } | null) {
  return Boolean(error && /store_knowledge_items|schema cache|does not exist/i.test(error.message));
}

function warnMissingStoreKnowledgeTable() {
  console.warn(`store_knowledge_items table is missing. Run: ${storeKnowledgeSql}`);
}

export function isMissingUsedKnowledgeColumnError(error: { message: string } | null) {
  return Boolean(error && /used_knowledge_items/i.test(error.message));
}

export function warnMissingUsedKnowledgeColumn() {
  console.warn(`cs_messages used_knowledge_items column is missing. Run: ${usedKnowledgeItemsSql}`);
}

function isMissingStoreKnowledgeStatusColumnError(error: { message: string } | null) {
  return Boolean(error && /status/i.test(error.message));
}

function warnMissingStoreKnowledgeStatusColumn() {
  console.warn(`store_knowledge_items status column is missing. Run: ${storeKnowledgeStatusSql}`);
}

export function mapMissingInfoTopicToKnowledgeCategory(
  topic?: string | null,
): StoreKnowledgeCategory {
  switch (topic) {
    case "pricing":
      return "pricing";
    case "shipping_fee":
    case "shipping_schedule":
      return "shipping";
    case "refund_exchange":
      return "refund_exchange";
    case "stock":
      return "stock";
    case "reservation":
      return "reservation";
    case "gift_wrapping":
    case "product_option":
      return "packaging";
    case "allergy":
    case "material":
      return "allergy_ingredient";
    case "product_composition":
    case "size_adjustment":
    case "care_instruction":
      return "product";
    default:
      return "general";
  }
}

export async function saveStoreKnowledgeItem({
  supabase,
  userId,
  storeId,
  category,
  question,
  answer,
  sourceId,
  sourceText,
}: StoreKnowledgeSaveInput) {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  if (!trimmedQuestion || !trimmedAnswer) {
    return { saved: false, skipped: true };
  }

  const now = new Date().toISOString();
  const existing = await supabase
    .from("store_knowledge_items")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("question", trimmedQuestion)
    .maybeSingle();

  if (isMissingStoreKnowledgeTableError(existing.error)) {
    warnMissingStoreKnowledgeTable();
    return { saved: false, missingTable: true };
  }

  if (existing.error) {
    console.warn("Failed to check existing store knowledge item.", existing.error);
    return { saved: false, error: existing.error.message };
  }

  if (existing.data?.id) {
    let { error } = await supabase
      .from("store_knowledge_items")
      .update({
        answer: trimmedAnswer,
        source_type: "missing_info",
        source_id: sourceId ? String(sourceId) : null,
        source_text: sourceText?.trim() || null,
        confidence: "owner_confirmed",
        status: "active",
        updated_at: now,
      })
      .eq("id", existing.data.id)
      .eq("user_id", userId);

    if (isMissingStoreKnowledgeStatusColumnError(error)) {
      warnMissingStoreKnowledgeStatusColumn();
      const fallback = await supabase
        .from("store_knowledge_items")
        .update({
          answer: trimmedAnswer,
          source_type: "missing_info",
          source_id: sourceId ? String(sourceId) : null,
          source_text: sourceText?.trim() || null,
          confidence: "owner_confirmed",
          updated_at: now,
        })
        .eq("id", existing.data.id)
        .eq("user_id", userId);
      error = fallback.error;
    }

    if (isMissingStoreKnowledgeTableError(error)) {
      warnMissingStoreKnowledgeTable();
      return { saved: false, missingTable: true };
    }

    if (error) {
      console.warn("Failed to update store knowledge item.", error);
      return { saved: false, error: error.message };
    }

    return { saved: true, updated: true };
  }

  let { error } = await supabase.from("store_knowledge_items").insert({
    user_id: userId,
    store_id: String(storeId),
    category,
    question: trimmedQuestion,
    answer: trimmedAnswer,
    source_type: "missing_info",
    source_id: sourceId ? String(sourceId) : null,
    source_text: sourceText?.trim() || null,
    confidence: "owner_confirmed",
    status: "active",
    created_at: now,
    updated_at: now,
  });

  if (isMissingStoreKnowledgeStatusColumnError(error)) {
    warnMissingStoreKnowledgeStatusColumn();
    const fallback = await supabase.from("store_knowledge_items").insert({
      user_id: userId,
      store_id: String(storeId),
      category,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      source_type: "missing_info",
      source_id: sourceId ? String(sourceId) : null,
      source_text: sourceText?.trim() || null,
      confidence: "owner_confirmed",
      created_at: now,
      updated_at: now,
    });
    error = fallback.error;
  }

  if (isMissingStoreKnowledgeTableError(error)) {
    warnMissingStoreKnowledgeTable();
    return { saved: false, missingTable: true };
  }

  if (error) {
    console.warn("Failed to insert store knowledge item.", error);
    return { saved: false, error: error.message };
  }

  return { saved: true, inserted: true };
}

export async function loadStoreKnowledgeItems({
  supabase,
  userId,
  limit = 50,
}: StoreKnowledgeLoadInput) {
  const { data, error } = await supabase
    .from("store_knowledge_items")
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (isMissingStoreKnowledgeTableError(error)) {
    warnMissingStoreKnowledgeTable();
    return [];
  }

  if (error) {
    if (isMissingStoreKnowledgeStatusColumnError(error)) {
      warnMissingStoreKnowledgeStatusColumn();
      const fallback = await supabase
        .from("store_knowledge_items")
        .select(
          "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (fallback.error) {
        console.warn("Failed to load store knowledge items.", fallback.error);
        return [];
      }

      return (fallback.data ?? []).map((item) => ({
        ...item,
        status: "active",
      })) as StoreKnowledgeItem[];
    }

    console.warn("Failed to load store knowledge items.", error);
    return [];
  }

  return (data ?? []) as StoreKnowledgeItem[];
}

const categoryIntentKeywords: Record<string, string[]> = {
  pricing: ["가격", "얼마", "금액", "비용", "몇원", "몇 원", "총액", "견적"],
  shipping: ["배송", "출고", "발송", "도착", "택배", "수령", "오늘 보내"],
  refund_exchange: ["환불", "취소", "반품", "교환", "돈 돌려"],
  stock: ["재고", "남아", "품절", "구매 가능", "주문 가능"],
  reservation: ["예약", "픽업", "방문 수령", "수령 시간", "몇 시"],
  packaging: [
    "포장",
    "선물 포장",
    "쇼핑백",
    "포장비",
    "기프트",
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
    "충전기",
    "어댑터",
    "케이블",
    "리본",
    "스티커",
    "파우치",
    "설명서",
    "보증서",
  ],
  allergy_ingredient: [
    "알레르기",
    "알러지",
    "성분",
    "원재료",
    "두드러기",
    "피부",
    "가려움",
  ],
  product: ["상품", "구성", "용량", "사이즈", "사용법", "보관"],
  general: [],
};

const genericKnowledgeTokens = new Set([
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

function normalizeKnowledgeText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function stripPostposition(value: string) {
  return value.replace(/(으로|에게|에서|까지|부터|은|는|이|가|을|를|의|에|와|과|도|로|만)$/g, "");
}

function getKnowledgeTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map((token) => stripPostposition(token.trim()))
      .filter(
        (token) =>
          token.length >= 2 && !genericKnowledgeTokens.has(token),
      ),
  );
}

function getKeywordMatchCount(value: string, keywords: string[]) {
  const normalizedValue = normalizeKnowledgeText(value);

  return keywords.filter((keyword) =>
    normalizedValue.includes(normalizeKnowledgeText(keyword)),
  ).length;
}

function getTokenOverlapScore(left: string, right: string) {
  const leftTokens = [...getKnowledgeTokens(left)];
  const rightTokens = [...getKnowledgeTokens(right)];

  return leftTokens.filter((leftToken) =>
    rightTokens.some(
      (rightToken) =>
        leftToken === rightToken ||
        (Math.min(leftToken.length, rightToken.length) >= 2 &&
          (leftToken.includes(rightToken) || rightToken.includes(leftToken))),
    ),
  ).length;
}

function scoreKnowledgeItem(customerMessage: string, item: StoreKnowledgeItem) {
  const itemText = [item.question, item.answer, item.source_text ?? ""].join("\n");
  const categoryKeywords = categoryIntentKeywords[item.category] ?? [];
  const messageKeywordMatches = getKeywordMatchCount(
    customerMessage,
    categoryKeywords,
  );
  const itemKeywordMatches = getKeywordMatchCount(itemText, categoryKeywords);
  const tokenOverlapScore = getTokenOverlapScore(customerMessage, itemText);
  const normalizedMessage = normalizeKnowledgeText(customerMessage);
  const normalizedQuestion = normalizeKnowledgeText(item.question);
  const directQuestionMatch =
    normalizedQuestion.length >= 6 &&
    (normalizedMessage.includes(normalizedQuestion) ||
      normalizedQuestion.includes(normalizedMessage));

  if (!directQuestionMatch && tokenOverlapScore === 0) {
    return 0;
  }

  if (
    categoryKeywords.length > 0 &&
    messageKeywordMatches === 0 &&
    !directQuestionMatch
  ) {
    return 0;
  }

  let score = tokenOverlapScore * 4;

  if (messageKeywordMatches > 0 && itemKeywordMatches > 0) {
    score += 5 + Math.min(messageKeywordMatches + itemKeywordMatches, 4);
  }

  if (directQuestionMatch) {
    score += 8;
  }

  return score;
}

export function selectRelevantStoreKnowledgeItems(
  customerMessage: string,
  items: StoreKnowledgeItem[],
  limit = 3,
) {
  const usableItems = items.filter((item) => (item.status ?? "active") === "active");
  const qualityReport = buildStoreKnowledgeQualityReport(
    usableItems.filter(
      (
        item,
      ): item is StoreKnowledgeItem & {
        id: string;
      } => typeof item.id === "string" && item.id.length > 0,
    ),
  );

  return usableItems
    .map((item) => {
      const quality = item.id ? qualityReport.byId[item.id] : null;
      const score = scoreKnowledgeItem(customerMessage, item);

      return {
        item,
        score:
          score -
          (quality?.isStale ? 2 : 0) -
          Math.min(quality?.duplicateCount ?? 0, 2),
        hasConflict: (quality?.conflictCount ?? 0) > 0,
      };
    })
    .filter(({ hasConflict }) => !hasConflict)
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      return (
        new Date(b.item.updated_at ?? 0).getTime() -
        new Date(a.item.updated_at ?? 0).getTime()
      );
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

export function createUsedKnowledgeSnapshot(
  items: StoreKnowledgeItem[],
): UsedStoreKnowledgeItem[] {
  return items
    .filter((item) => item.id && item.question.trim() && item.answer.trim())
    .map((item) => ({
      id: item.id!,
      category: item.category || "general",
      question: item.question.trim(),
      answer: item.answer.trim(),
    }));
}

function truncateEvidenceAnswer(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function hasAnyKnowledgeKeyword(value: string, keywords: string[]) {
  const normalizedValue = normalizeKnowledgeText(value);

  return keywords.some((keyword) =>
    normalizedValue.includes(normalizeKnowledgeText(keyword)),
  );
}

function hasStoreFieldOverlap(customerMessage: string, fieldValue?: string | null) {
  const fieldText = fieldValue?.trim() ?? "";

  if (!fieldText) return false;

  return getTokenOverlapScore(customerMessage, fieldText) > 0;
}

function createStoreInfoEvidenceItem({
  id,
  category,
  question,
  answer,
}: {
  id: string;
  category: string;
  question: string;
  answer?: string | null;
}): UsedStoreKnowledgeItem | null {
  const trimmedAnswer = answer?.trim() ?? "";

  if (!trimmedAnswer) return null;

  return {
    id,
    category,
    question,
    answer: truncateEvidenceAnswer(trimmedAnswer),
  };
}

export function createStoreInfoEvidenceSnapshot(
  customerMessage: string,
  store: CsReplyPromptStore,
): UsedStoreKnowledgeItem[] {
  const evidenceItems: Array<UsedStoreKnowledgeItem | null> = [];
  const isPricingInquiry = hasAnyKnowledgeKeyword(customerMessage, [
    "가격",
    "얼마",
    "금액",
    "비용",
    "몇 원",
    "몇원",
    "총액",
    "견적",
  ]);
  const isShippingInquiry = hasAnyKnowledgeKeyword(customerMessage, [
    "배송",
    "출고",
    "발송",
    "오늘 보내",
    "언제 받아",
    "도착",
    "택배",
    "수령",
  ]);
  const isRefundInquiry = hasAnyKnowledgeKeyword(customerMessage, [
    "환불",
    "취소",
    "반품",
    "교환",
    "돈 돌려",
    "환불 가능",
    "취소 가능",
  ]);
  const isProductInquiry = hasAnyKnowledgeKeyword(customerMessage, [
    "상품",
    "제품",
    "구성",
    "용량",
    "사이즈",
    "재질",
    "성분",
    "원재료",
    "보관",
    "사용법",
    "포함",
    "동봉",
    "제공",
  ]);
  const isFaqOrOptionInquiry = hasAnyKnowledgeKeyword(customerMessage, [
    "포장",
    "선물",
    "쇼핑백",
    "옵션",
    "추가",
    "변경",
    "조절",
    "선택",
    "각인",
    "커스텀",
    "가능",
  ]);
  const hasProductCatalogOverlap =
    isPricingInquiry ||
    isProductInquiry ||
    hasStoreFieldOverlap(customerMessage, store.product_catalog);
  const hasRepresentativeProductOverlap =
    isProductInquiry ||
    isPricingInquiry ||
    [
      store.product_name,
      store.product_description,
      store.product_details,
      store.product_caution,
    ].some((fieldValue) => hasStoreFieldOverlap(customerMessage, fieldValue));

  if (hasProductCatalogOverlap) {
    evidenceItems.push(
      createStoreInfoEvidenceItem({
        id: "store:product_catalog",
        category: isPricingInquiry ? "pricing" : "product_catalog",
        question: "상품 목록",
        answer: store.product_catalog,
      }),
    );
  }

  if (hasRepresentativeProductOverlap) {
    evidenceItems.push(
      createStoreInfoEvidenceItem({
        id: "store:product_details",
        category: "product",
        question: "대표 상품 정보",
        answer: [
          store.product_name,
          store.product_description,
          store.product_details,
          store.product_caution,
        ]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join("\n"),
      }),
    );
  }

  if (isShippingInquiry || hasStoreFieldOverlap(customerMessage, store.shipping_policy)) {
    evidenceItems.push(
      createStoreInfoEvidenceItem({
        id: "store:shipping_policy",
        category: "shipping",
        question: "배송정책",
        answer: store.shipping_policy,
      }),
    );
  }

  if (isRefundInquiry || hasStoreFieldOverlap(customerMessage, store.refund_policy)) {
    evidenceItems.push(
      createStoreInfoEvidenceItem({
        id: "store:refund_policy",
        category: "refund_exchange",
        question: "환불정책",
        answer: store.refund_policy,
      }),
    );
  }

  if (
    isFaqOrOptionInquiry ||
    (!isPricingInquiry && hasStoreFieldOverlap(customerMessage, store.extra_faq))
  ) {
    evidenceItems.push(
      createStoreInfoEvidenceItem({
        id: "store:extra_faq",
        category: isFaqOrOptionInquiry ? "packaging" : "general",
        question: "기타 FAQ/포장·옵션",
        answer: store.extra_faq,
      }),
    );
  }

  return evidenceItems.filter((item): item is UsedStoreKnowledgeItem =>
    Boolean(item),
  );
}

export function mergeUsedKnowledgeSnapshots(
  ...snapshots: UsedStoreKnowledgeItem[][]
): UsedStoreKnowledgeItem[] {
  const uniqueItems = new Map<string, UsedStoreKnowledgeItem>();

  for (const item of snapshots.flat()) {
    if (!item.id || !item.question.trim() || !item.answer.trim()) continue;
    if (!uniqueItems.has(item.id)) {
      uniqueItems.set(item.id, item);
    }
  }

  return [...uniqueItems.values()];
}

export function withoutUsedKnowledgeItems<
  T extends { used_knowledge_items?: unknown },
>(row: T) {
  const fallbackRow = { ...row };
  delete fallbackRow.used_knowledge_items;
  return fallbackRow;
}

export function formatStoreKnowledgeForPrompt(items: StoreKnowledgeItem[]) {
  if (items.length === 0) return "";

  return [
    "[사장님이 확인해준 가게 지식]",
    ...items.map((item) => {
      const category = item.category || "general";

      return `- (${category}) ${item.question}: ${item.answer}`;
    }),
  ].join("\n");
}

export function mergeStoreKnowledgeIntoStore<T extends CsReplyPromptStore>(
  store: T,
  knowledgeItems: StoreKnowledgeItem[],
): T {
  const knowledgeText = formatStoreKnowledgeForPrompt(knowledgeItems);

  if (!knowledgeText) return store;

  return {
    ...store,
    extra_faq: [store.extra_faq?.trim(), knowledgeText]
      .filter(Boolean)
      .join("\n\n"),
  };
}
