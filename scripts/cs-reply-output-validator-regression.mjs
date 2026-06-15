import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function loadTypeScriptModule(relativePath, dependencies = {}) {
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
      const dependency = Object.entries(dependencies).find(([key]) =>
        specifier.includes(key),
      );
      return dependency?.[1] ?? {};
    },
    console,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return sandbox.exports;
}

const caseIntake = loadTypeScriptModule("app/lib/csCaseIntake.ts");
const incidentResponse = loadTypeScriptModule("app/lib/csIncidentResponse.ts");
const riskSignals = loadTypeScriptModule("app/lib/riskSignals.ts");
const outputValidator = loadTypeScriptModule(
  "app/lib/csReplyOutputValidator.ts",
  {
    csCaseIntake: caseIntake,
    csIncidentResponse: incidentResponse,
    riskSignals,
  },
);

const { validateCsReplyOutput } = outputValidator;
const store = {
  store_name: "테스트 상점",
  business_type: "테스트 업종",
};

const unsafePromise = validateCsReplyOutput({
  customerMessage: "소스가 빠졌어요.",
  decision: {
    reply: "죄송합니다. 소스를 바로 재배송해드리겠습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(unsafePromise.handlingType, "needs_review");
assert.equal(unsafePromise.guardType, "output_validation");
assert.doesNotMatch(unsafePromise.reply, /재배송해드리겠습니다/);
assert.match(unsafePromise.aiReason, /확인되지 않은 보상 또는 재처리 약속/);

const unsafeRefundPromise = validateCsReplyOutput({
  customerMessage: "환불해 주세요.",
  decision: {
    reply: "바로 환불 처리해드리겠습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(unsafeRefundPromise.handlingType, "needs_approval");
assert.equal(unsafeRefundPromise.riskLevel, "normal");
assert.doesNotMatch(unsafeRefundPromise.reply, /환불 처리해드리겠습니다/);

const unsafeHealthReply = validateCsReplyOutput({
  customerMessage: "먹고 두드러기가 올라왔어요.",
  decision: {
    reply: "사용된 재료 때문에 알레르기가 생긴 것 같습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(unsafeHealthReply.handlingType, "needs_approval");
assert.equal(unsafeHealthReply.riskLevel, "high");
assert.equal(unsafeHealthReply.guardType, "output_validation");
assert.doesNotMatch(unsafeHealthReply.reply, /때문|원인/);
assert.match(unsafeHealthReply.reply, /의료기관 상담/);

const repeatedOrderNumber = validateCsReplyOutput({
  customerMessage: "주문번호 A-12345인데 배송이 어디쯤인가요?",
  decision: {
    reply: "주문번호를 알려주시면 확인해보겠습니다.",
    handlingType: "needs_review",
    riskLevel: "normal",
  },
  store,
});
assert.equal(repeatedOrderNumber.guardType, "output_validation");
assert.doesNotMatch(repeatedOrderNumber.reply, /주문번호를 알려/);

const contradictoryAutoReady = validateCsReplyOutput({
  customerMessage: "배송 상태가 궁금해요.",
  decision: {
    reply: "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(contradictoryAutoReady.handlingType, "needs_review");
assert.equal(contradictoryAutoReady.guardType, "output_validation");

const disputeDecision = validateCsReplyOutput({
  customerMessage: "소비자원에 신고하겠습니다.",
  decision: {
    reply: "문의 내용을 확인해보겠습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(disputeDecision.handlingType, "needs_approval");
assert.equal(disputeDecision.riskLevel, "high");

const disputeWithPromise = validateCsReplyOutput({
  customerMessage: "소비자원에 신고하겠습니다. 보상해 주세요.",
  decision: {
    reply: "바로 보상해드리겠습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(disputeWithPromise.handlingType, "needs_approval");
assert.equal(disputeWithPromise.riskLevel, "high");
assert.doesNotMatch(disputeWithPromise.reply, /보상해드리겠습니다/);

const safeInformationReply = validateCsReplyOutput({
  customerMessage: "보관 방법을 알려주세요.",
  decision: {
    reply: "개봉 후에는 냉장 보관해 주세요.",
    handlingType: "auto_ready",
    riskLevel: "low",
  },
  store,
});
assert.equal(safeInformationReply.handlingType, "auto_ready");
assert.equal(safeInformationReply.guardType, undefined);

const generationSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/csReplyGeneration.ts"),
  "utf8",
);
assert.match(generationSource, /validateCsReplyOutput/);

for (const relativePath of [
  "app/api/cs-reply/route.ts",
  "app/lib/platformInquiryProcessing.ts",
]) {
  const integrationSource = fs.readFileSync(
    path.join(projectRoot, relativePath),
    "utf8",
  );
  assert.match(integrationSource, /output_validation/);
}

console.log("CS reply output validator regression tests passed.");
