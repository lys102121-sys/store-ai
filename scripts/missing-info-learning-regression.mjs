import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function loadTsModule(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    require(specifier) {
      if (specifier === "@supabase/supabase-js") return {};
      if (specifier === "@/app/lib/storeKnowledgeQuality") {
        return loadTsModule("app/lib/storeKnowledgeQuality.ts");
      }

      throw new Error(`Unexpected test import: ${specifier}`);
    },
    console,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

  return sandbox.exports;
}

const matching = loadTsModule("app/lib/missingInfoMatching.ts");
const storeKnowledge = loadTsModule("app/lib/storeKnowledge.ts");

function ids(items) {
  return items.map((item) => String(item.id));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const priceMissingInfo = {
  id: "missing-price",
  question: "케이크 가격을 등록해주세요.",
  source_message: "케이크 얼마인가요?",
  source_messages: [
    "케이크 얼마인가요?",
    "딸기 케이크 비용 안내 부탁드려요.",
  ],
  topic: "pricing",
};

const priceReferenceMessages = [
  priceMissingInfo.question,
  ...matching.normalizeSourceMessages(priceMissingInfo),
];
const pendingPriceMessages = [
  { id: "cs-price-1", customer_message: "딸기 케이크 비용 안내 부탁드려요." },
  { id: "cs-price-2", customer_message: "생일 케이크 1호 금액이 궁금해요." },
  { id: "cs-unrelated-1", customer_message: "오늘 배송되나요?" },
  { id: "cs-unrelated-2", customer_message: "재고 있나요?" },
];

assert.equal(matching.getMissingInfoTopic(priceMissingInfo), "pricing");
assert.deepEqual(
  ids(matching.findRelatedCsMessages(pendingPriceMessages, priceReferenceMessages)),
  ["cs-price-1", "cs-price-2"],
);

const packagingMissingInfo = {
  id: "missing-packaging",
  question: "선물 포장 가능 여부를 등록해주세요.",
  source_message: "선물 포장 가능한가요?",
  source_messages: ["선물 포장 가능한가요?"],
  topic: "gift_wrapping",
};
const packagingReferenceMessages = [
  packagingMissingInfo.question,
  ...matching.normalizeSourceMessages(packagingMissingInfo),
];
const pendingPackagingMessages = [
  { id: "cs-packaging-1", customer_message: "쇼핑백 같이 주시나요?" },
  { id: "cs-packaging-2", customer_message: "포장비 있나요?" },
  { id: "cs-unrelated-3", customer_message: "딸기 케이크 금액 궁금해요." },
];

assert.deepEqual(
  ids(
    matching.findRelatedCsMessages(
      pendingPackagingMessages,
      packagingReferenceMessages,
    ),
  ),
  ["cs-packaging-1", "cs-packaging-2"],
);

assert.equal(
  matching.appendAdditionalInfo("기존 FAQ: 냉장 보관 권장", "케이크 초는 1개 제공됩니다."),
  "기존 FAQ: 냉장 보관 권장\n추가 안내: 케이크 초는 1개 제공됩니다.",
);

assert.equal(
  storeKnowledge.mapMissingInfoTopicToKnowledgeCategory("pricing"),
  "pricing",
);
assert.equal(
  storeKnowledge.mapMissingInfoTopicToKnowledgeCategory("product_option"),
  "packaging",
);
assert.equal(
  storeKnowledge.mapMissingInfoTopicToKnowledgeCategory("allergy"),
  "allergy_ingredient",
);

const learnedKnowledgeItems = [
  {
    id: "knowledge-price",
    user_id: "user-1",
    category: "pricing",
    question: "케이크 가격을 등록해주세요.",
    answer: "딸기 생크림 케이크는 1호 30,000원입니다.",
    source_type: "missing_info",
    source_id: "missing-price",
    source_text: "케이크 얼마인가요?",
    confidence: "owner_confirmed",
    updated_at: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "knowledge-packaging",
    user_id: "user-1",
    category: "packaging",
    question: "충전기 포함 여부를 등록해주세요.",
    answer: "충전기는 기본 포함되어 있습니다.",
    source_type: "missing_info",
    source_id: "missing-option",
    source_text: "충전기도 포함인가요?",
    confidence: "owner_confirmed",
    updated_at: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "knowledge-allergy",
    user_id: "user-1",
    category: "allergy_ingredient",
    question: "원재료와 알레르기 안내를 등록해주세요.",
    answer: "견과류가 포함될 수 있어 알레르기가 있으면 섭취 전 확인이 필요합니다.",
    source_type: "missing_info",
    source_id: "missing-allergy",
    source_text: "알레르기 성분 있나요?",
    confidence: "owner_confirmed",
    updated_at: "2026-06-05T00:00:00.000Z",
  },
];

assert.deepEqual(
  ids(
    storeKnowledge.selectRelevantStoreKnowledgeItems(
      "딸기 케이크 비용 안내 부탁드려요.",
      learnedKnowledgeItems,
    ),
  ),
  ["knowledge-price"],
);

assert.deepEqual(
  ids(
    storeKnowledge.selectRelevantStoreKnowledgeItems(
      "충전기도 포함인가요?",
      learnedKnowledgeItems,
    ),
  ),
  ["knowledge-packaging"],
);

assert.deepEqual(
  ids(
    storeKnowledge.selectRelevantStoreKnowledgeItems(
      "알레르기 성분 있나요?",
      learnedKnowledgeItems,
    ),
  ),
  ["knowledge-allergy"],
);

const conflictingKnowledgeItems = [
  ...learnedKnowledgeItems,
  {
    id: "knowledge-candle-yes",
    user_id: "user-1",
    category: "packaging",
    question: "케이크 초 제공 여부를 등록해주세요.",
    answer: "케이크 초는 1개 제공됩니다.",
    source_type: "missing_info",
    source_id: "missing-candle",
    source_text: "케이크 초도 같이 주시나요?",
    confidence: "owner_confirmed",
    updated_at: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "knowledge-candle-no",
    user_id: "user-1",
    category: "packaging",
    question: "케이크 초 제공 여부를 등록해주세요.",
    answer: "케이크 초는 제공하지 않습니다.",
    source_type: "owner_correction",
    source_id: "cs-candle",
    source_text: "케이크 초도 같이 주시나요?",
    confidence: "owner_confirmed",
    updated_at: "2026-06-06T00:00:00.000Z",
  },
];

assert.deepEqual(
  ids(
    storeKnowledge.selectRelevantStoreKnowledgeItems(
      "케이크 초도 같이 주시나요?",
      conflictingKnowledgeItems,
    ),
  ),
  [],
);

assert.deepEqual(
  ids(
    storeKnowledge.selectRelevantStoreKnowledgeItems(
      "딸기 케이크 비용 안내 부탁드려요.",
      [
        { ...learnedKnowledgeItems[0], status: "needs_review" },
        { ...learnedKnowledgeItems[1], status: "archived" },
      ],
    ),
  ),
  [],
);

assert.deepEqual(
  plain(storeKnowledge.createUsedKnowledgeSnapshot([learnedKnowledgeItems[0]])),
  [
    {
      id: "knowledge-price",
      category: "pricing",
      question: "케이크 가격을 등록해주세요.",
      answer: "딸기 생크림 케이크는 1호 30,000원입니다.",
    },
  ],
);

const storeInfoEvidenceStore = {
  user_id: "user-1",
  store_name: "테스트 가게",
  business_type: "디저트/카페",
  shipping_policy: "오후 2시 이전 주문은 당일 출고됩니다.",
  refund_policy: "제조 시작 후에는 단순 변심 취소가 어렵습니다.",
  product_name: "딸기 생크림 케이크",
  product_description: "딸기를 올린 생크림 케이크입니다.",
  product_details: "1호 30,000원",
  product_caution: "우유, 계란, 밀 포함",
  product_catalog: "[딸기 생크림 케이크]\n- 1호 30,000원",
  extra_faq: "케이크 초는 1개 제공됩니다.",
  owner_cs_examples: "",
  created_at: null,
  updated_at: null,
};

assert.deepEqual(
  plain(ids(
    storeKnowledge.createStoreInfoEvidenceSnapshot(
      "딸기 케이크 얼마인가요?",
      storeInfoEvidenceStore,
    ),
  )),
  ["store:product_catalog", "store:product_details"],
);

assert.deepEqual(
  plain(ids(
    storeKnowledge.createStoreInfoEvidenceSnapshot(
      "오늘 출고되나요?",
      storeInfoEvidenceStore,
    ),
  )),
  ["store:shipping_policy"],
);

assert.deepEqual(
  plain(ids(
    storeKnowledge.createStoreInfoEvidenceSnapshot(
      "케이크 초도 같이 주시나요?",
      storeInfoEvidenceStore,
    ),
  )),
  ["store:product_catalog", "store:product_details", "store:extra_faq"],
);

assert.deepEqual(
  plain(ids(
    storeKnowledge.mergeUsedKnowledgeSnapshots(
      [{ id: "store:extra_faq", category: "general", question: "FAQ", answer: "A" }],
      [{ id: "store:extra_faq", category: "general", question: "FAQ", answer: "B" }],
    ),
  )),
  ["store:extra_faq"],
);

const mergedStore = storeKnowledge.mergeStoreKnowledgeIntoStore(
  {
    user_id: "user-1",
    store_name: "테스트 상점",
    business_type: "디저트/카페",
    shipping_policy: "",
    refund_policy: "",
    product_name: "",
    product_description: "",
    product_details: "",
    product_caution: "",
    product_catalog: "",
    extra_faq: "기존 FAQ: 냉장 보관 권장",
    owner_cs_examples: "",
    created_at: null,
    updated_at: null,
  },
  [learnedKnowledgeItems[0]],
);

assert.match(mergedStore.extra_faq, /기존 FAQ: 냉장 보관 권장/);
assert.match(mergedStore.extra_faq, /사장님이 확인해준 가게 지식/);
assert.match(mergedStore.extra_faq, /딸기 생크림 케이크는 1호 30,000원입니다/);

console.log("Missing info learning regression tests passed.");
