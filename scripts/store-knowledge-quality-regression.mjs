import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/storeKnowledgeQuality.ts");

function loadStoreKnowledgeQuality() {
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = { exports: {}, console };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

  return sandbox.exports;
}

const {
  STORE_KNOWLEDGE_STALE_DAYS,
  buildStoreKnowledgeQualityReport,
} = loadStoreKnowledgeQuality();

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const report = buildStoreKnowledgeQualityReport([
  {
    id: "price-old",
    category: "pricing",
    question: "케이크 가격을 등록해주세요.",
    answer: "1호 케이크는 30,000원입니다.",
    updated_at: daysAgo(STORE_KNOWLEDGE_STALE_DAYS + 1),
  },
  {
    id: "price-conflict",
    category: "pricing",
    question: "케이크 얼마인가요?",
    answer: "1호 케이크는 35,000원입니다.",
    updated_at: daysAgo(1),
  },
  {
    id: "wrap-a",
    category: "packaging",
    question: "선물 포장 가능 여부",
    answer: "선물 포장 가능합니다.",
    updated_at: daysAgo(1),
  },
  {
    id: "wrap-b",
    category: "packaging",
    question: "선물 포장 가능 여부",
    answer: "선물 포장 가능합니다.",
    updated_at: daysAgo(2),
  },
  {
    id: "stock-ok",
    category: "stock",
    question: "재고 있나요?",
    answer: "재고는 매일 변동되어 확인 후 안내합니다.",
    updated_at: daysAgo(1),
  },
]);

assert.equal(report.summary.totalCount, 5);
assert.equal(report.summary.staleCount, 1);
assert.equal(report.summary.conflictCount, 2);
assert.equal(report.summary.duplicateCount, 2);
assert.equal(report.summary.reviewCount, 4);

assert.equal(report.byId["price-old"].isStale, true);
assert.equal(report.byId["price-old"].conflictCount, 1);
assert.equal(report.byId["price-old"].conflictItems[0].id, "price-conflict");
assert.equal(report.byId["price-conflict"].conflictCount, 1);
assert.equal(report.byId["price-conflict"].conflictItems[0].id, "price-old");
assert.equal(report.byId["wrap-a"].duplicateCount, 1);
assert.equal(report.byId["wrap-b"].duplicateCount, 1);
assert.equal(report.byId["stock-ok"].conflictCount, 0);
assert.equal(report.byId["stock-ok"].duplicateCount, 0);
assert.equal(report.byId["stock-ok"].isStale, false);

console.log("Store knowledge quality regression tests passed.");
