import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csWorkflowClaimGuard.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = {
  exports: {},
  require() {
    return {};
  },
  console,
};

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const { applyWorkflowClaimGuard, hasUnverifiedWorkflowClaim } = sandbox.exports;
const store = { store_name: "테스트 상점" };

[
  "입금 확인이 완료되었습니다.",
  "A/S 접수가 완료되었습니다.",
  "제품 검수가 완료되었습니다.",
  "주문하신 상품은 금일 출고될 예정입니다.",
  "송장번호는 1234-5678-9012입니다.",
].forEach((reply) => {
  assert.equal(
    hasUnverifiedWorkflowClaim(reply),
    true,
    `${reply} should require live workflow verification.`,
  );
});

[
  "오후 2시 이전 주문은 당일 출고됩니다.",
  "반품 접수 후 상품 상태를 확인합니다.",
  "불량으로 확인되면 교환 출고가 가능합니다.",
  "정확한 진행 상태는 확인 후 안내드리겠습니다.",
].forEach((reply) => {
  assert.equal(
    hasUnverifiedWorkflowClaim(reply),
    false,
    `${reply} is a policy or conditional statement, not a completed workflow claim.`,
  );
});

const guarded = applyWorkflowClaimGuard({
  customerMessage: "입금했는데 확인됐나요?",
  reply: "입금 확인되었습니다. 오늘 출고됩니다.",
  store,
});

assert.ok(guarded);
assert.equal(guarded.handlingType, "needs_review");
assert.equal(guarded.guardType, "workflow_verification");
assert.match(guarded.aiReason, /실제 주문, 결제, 접수 또는 배송 진행 상태/);
assert.match(guarded.reply, /정확한 진행 상태는 확인 후 안내/);
assert.match(guarded.reply, /주문 또는 접수 정보/);
assert.doesNotMatch(guarded.reply, /입금 확인되었습니다|오늘 출고됩니다/);

console.log("CS workflow claim regression tests passed.");
