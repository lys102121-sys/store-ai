import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/storeKnowledgeUsage.ts");

function loadStoreKnowledgeUsage() {
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

const { buildStoreKnowledgeUsageMap } = loadStoreKnowledgeUsage();

const usageMap = buildStoreKnowledgeUsageMap(
  [
    {
      id: 1,
      customerMessage: "케이크 얼마인가요?",
      reply: "1호 케이크는 30,000원입니다.",
      status: "completed",
      sourcePlatform: "manual",
      createdAt: "2026-06-01T00:00:00.000Z",
      usedKnowledgeItems: [{ id: "price" }],
    },
    {
      id: 2,
      customerMessage: "딸기 케이크 가격 궁금해요.",
      reply: "딸기 케이크는 30,000원입니다.",
      status: "pending",
      sourcePlatform: "coupang",
      createdAt: "2026-06-03T00:00:00.000Z",
      usedKnowledgeItems: [{ id: "price" }, { id: "price" }],
    },
    {
      id: 3,
      customerMessage: "선물 포장 되나요?",
      reply: "선물 포장 가능합니다.",
      status: "completed",
      sourcePlatform: "manual",
      createdAt: "2026-06-02T00:00:00.000Z",
      usedKnowledgeItems: [{ id: "wrap" }],
    },
    {
      id: 4,
      customerMessage: "케이크 금액 알려주세요.",
      reply: "1호 케이크는 30,000원입니다.",
      status: "pending",
      sourcePlatform: "baemin",
      createdAt: "2026-06-04T00:00:00.000Z",
      usedKnowledgeItems: [{ id: "price" }, { id: "" }],
    },
    {
      id: 5,
      customerMessage: "케이크 비용 문의합니다.",
      reply: "1호 케이크는 30,000원입니다.",
      status: "pending",
      sourcePlatform: "yogiyo",
      createdAt: "2026-06-05T00:00:00.000Z",
      usedKnowledgeItems: [{ id: "price" }],
    },
  ],
  3,
);

assert.equal(
  JSON.stringify(usageMap.price.map((usage) => usage.id)),
  JSON.stringify([5, 4, 2]),
  "Knowledge usage should be latest-first and limited.",
);
assert.equal(
  usageMap.price.filter((usage) => usage.id === 2).length,
  1,
  "The same knowledge id should be counted once per message.",
);
assert.equal(
  JSON.stringify(usageMap.wrap.map((usage) => usage.id)),
  JSON.stringify([3]),
);
assert.equal(usageMap[""], undefined);

console.log("Store knowledge usage regression tests passed.");
