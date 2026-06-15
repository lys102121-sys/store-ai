import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csServiceEscalation.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const {
  applyCsServiceEscalation,
  buildCsServiceEscalationPrompt,
  detectCsServiceEscalation,
} = sandbox.exports;

const cases = [
  ["아이 손에 상처가 났어요.", "customer_harm", "high"],
  ["교환받은 제품도 또 고장났어요.", "repeat_failure", "high"],
  ["톡을 읽고도 답변이 없고 회수 기사도 안 왔어요.", "service_breakdown", "normal"],
  ["포장에 사용 흔적이 있어 중고품 같아요.", "used_product_suspicion", "high"],
  ["주문한 소스가 빠졌고 다른 메뉴가 왔어요.", "fulfillment_issue", "normal"],
];

for (const [message, kind, riskLevel] of cases) {
  const escalation = detectCsServiceEscalation(message);
  assert.ok(escalation, `${message} should be escalated.`);
  assert.equal(escalation.kind, kind);
  assert.equal(escalation.riskLevel, riskLevel);

  const decision = applyCsServiceEscalation(message, {
    reply: "확인했습니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
    aiReason: "",
  });
  assert.equal(decision.handlingType, "needs_approval");
  assert.equal(decision.riskLevel, riskLevel);
  assert.ok(decision.aiReason);
}

[
  "배송비가 얼마인가요?",
  "선물 포장이 가능한가요?",
  "상품이 마음에 들어요.",
].forEach((message) => {
  assert.equal(detectCsServiceEscalation(message), null);
});

const prompt = buildCsServiceEscalationPrompt();
assert.match(prompt, /이전 처리 이력/);
assert.match(prompt, /주문, 예약, 접수, 배달, 방문, 픽업, 수거/);
assert.match(prompt, /상품·메뉴·옵션·수량·객실·예약 시간·시술·수업·제작 결과/);
assert.match(prompt, /반품 상품 재출고/);
assert.match(prompt, /부상이 언급되면 risk_level을 high/);

for (const relativePath of [
  "app/lib/csReplyGeneration.ts",
  "app/lib/reviewReplyGeneration.ts",
]) {
  const integrationSource = fs.readFileSync(
    path.join(projectRoot, relativePath),
    "utf8",
  );
  assert.match(
    integrationSource,
    /applyCsServiceEscalation/,
    `${relativePath} should apply the shared escalation rules.`,
  );
}

const manualCsReplyRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-reply/route.ts"),
  "utf8",
);
assert.match(manualCsReplyRoute, /generateCsReplyDecision/);

const reviewPromptSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/prompts/reviewReplyPrompt.ts"),
  "utf8",
);
assert.match(reviewPromptSource, /buildCsServiceEscalationPrompt/);

console.log("CS service escalation regression tests passed.");
