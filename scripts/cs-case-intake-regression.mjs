import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csCaseIntake.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const { buildCsCaseIntakePrompt, classifyCsCase } = sandbox.exports;

const cases = [
  ["먹고 두드러기가 올라왔어요.", "safety_harm"],
  ["지난번에도 소스가 빠졌는데 오늘 또 누락됐어요.", "repeat_issue"],
  ["예약 변경 문의를 남겼는데 답변이 없어요.", "service_breakdown"],
  ["예약을 취소하고 환불받고 싶어요.", "cancellation_refund"],
  ["금연 객실을 예약했는데 다른 객실로 배정됐어요.", "request_mismatch"],
  ["교체한 장비가 작동하지 않아요.", "quality_issue"],
  ["제 주문은 언제 출고되나요?", "progress_status"],
  ["예약 시간을 변경하고 싶어요.", "change_request"],
  ["케이크 가격이 얼마인가요?", "information_request"],
];

for (const [message, expectedType] of cases) {
  assert.equal(
    classifyCsCase(message).type,
    expectedType,
    `${message} should be classified as ${expectedType}.`,
  );
}

const safetyPrompt = buildCsCaseIntakePrompt(
  "시술 후 피부가 붉어지고 가려워요.",
);
assert.match(safetyPrompt, /안전·건강 문제/);
assert.match(safetyPrompt, /원인이나 책임을 단정하지 말고/);
assert.match(safetyPrompt, /이미 말한 정보는 다시 묻지 마세요/);
assert.match(safetyPrompt, /꼭 필요한 정보만 요청/);

const generationSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/csReplyGeneration.ts"),
  "utf8",
);
assert.match(generationSource, /buildCsCaseIntakePrompt/);

console.log("CS case intake regression tests passed.");
