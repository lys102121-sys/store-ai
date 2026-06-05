import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/riskSignals.ts");

function loadRiskSignals() {
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
  hasDisputeSignal,
  hasHealthSafetySignal,
  hasRefundExchangeSignal,
  hasStrongComplaintSignal,
} = loadRiskSignals();

[
  "알레르기 반응이 생겼어요.",
  "상품 사용 후 피부가 가려워졌어요.",
  "먹고 배가 아프고 복통이 있어요.",
  "두드러기와 발진이 올라왔어요.",
  "음식이 상한 것 같아요.",
  "위생 상태가 걱정됩니다.",
  "호흡이 불편해서 병원에 갔어요.",
].forEach((message) => {
  assert.equal(
    hasHealthSafetySignal(message),
    true,
    `${message} should be treated as a health/safety signal.`,
  );
});

[
  "맛있게 잘 먹었습니다.",
  "포장이 예뻐서 선물하기 좋았어요.",
  "배송은 빨랐고 상품도 마음에 들어요.",
].forEach((message) => {
  assert.equal(
    hasHealthSafetySignal(message),
    false,
    `${message} should not be treated as a health/safety signal.`,
  );
});

[
  "소비자원에 신고하겠습니다.",
  "법적 대응을 검토 중입니다.",
  "보상 안 해주시면 고소하겠습니다.",
].forEach((message) => {
  assert.equal(
    hasDisputeSignal(message),
    true,
    `${message} should be treated as a dispute signal.`,
  );
});

[
  "환불 가능한가요?",
  "반품하고 싶어요.",
  "교환이나 취소 가능한지 궁금합니다.",
].forEach((message) => {
  assert.equal(
    hasRefundExchangeSignal(message),
    true,
    `${message} should be treated as a refund/exchange signal.`,
  );
});

[
  "최악입니다.",
  "너무 화나서 항의합니다.",
  "클레임 넣고 싶어요.",
].forEach((message) => {
  assert.equal(
    hasStrongComplaintSignal(message),
    true,
    `${message} should be treated as a strong complaint signal.`,
  );
});

console.log("Risk signal regression tests passed.");
