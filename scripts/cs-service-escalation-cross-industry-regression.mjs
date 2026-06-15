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

const { detectCsServiceEscalation } = sandbox.exports;

const crossIndustryCases = [
  {
    businessType: "배달 음식점",
    message: "지난번에도 소스가 빠졌는데 오늘도 또 누락됐어요.",
    kind: "repeat_failure",
    riskLevel: "high",
  },
  {
    businessType: "카페",
    message: "아이스로 주문했는데 뜨거운 음료가 나왔어요.",
    kind: "fulfillment_issue",
    riskLevel: "normal",
  },
  {
    businessType: "미용실",
    message: "지난번에도 예약이 누락됐는데 이번에도 또 예약이 안 잡혀 있어요.",
    kind: "repeat_failure",
    riskLevel: "high",
  },
  {
    businessType: "학원",
    message: "보강 신청을 두 번 했는데 계속 반영이 안 됐어요.",
    kind: "repeat_failure",
    riskLevel: "high",
  },
  {
    businessType: "숙박",
    message: "금연 객실을 예약했는데 흡연 객실로 배정됐어요.",
    kind: "fulfillment_issue",
    riskLevel: "normal",
  },
  {
    businessType: "공방",
    message: "각인 문구가 주문한 내용과 다르게 제작됐어요.",
    kind: "fulfillment_issue",
    riskLevel: "normal",
  },
  {
    businessType: "렌탈",
    message: "교체받은 장비도 다시 작동하지 않아요.",
    kind: "repeat_failure",
    riskLevel: "high",
  },
  {
    businessType: "방문 서비스",
    message: "예약 변경 문의를 세 번 남겼는데 답변이 없어요.",
    kind: "service_breakdown",
    riskLevel: "normal",
  },
  {
    businessType: "음식점",
    message: "음식을 먹다가 뼈 때문에 입안을 다쳤어요.",
    kind: "customer_harm",
    riskLevel: "high",
  },
  {
    businessType: "피부 관리",
    message: "시술 중 피부에 화상을 입었어요.",
    kind: "customer_harm",
    riskLevel: "high",
  },
];

for (const { businessType, message, kind, riskLevel } of crossIndustryCases) {
  const escalation = detectCsServiceEscalation(message);
  assert.ok(escalation, `${businessType}: ${message} should be escalated.`);
  assert.equal(escalation.kind, kind, `${businessType}: unexpected kind.`);
  assert.equal(
    escalation.riskLevel,
    riskLevel,
    `${businessType}: unexpected risk level.`,
  );
}

const ordinaryQuestions = [
  "지난번에도 맛있었고 오늘도 맛있어요.",
  "다른 메뉴도 추천해 주세요.",
  "예약 가능한가요?",
  "아이스와 뜨거운 음료 둘 다 있나요?",
  "수업은 몇 번 진행하나요?",
  "객실 종류를 알려주세요.",
  "다시 다른 상품으로 주문하고 싶어요.",
  "다시 신청해도 문제가 없나요?",
];

for (const message of ordinaryQuestions) {
  assert.equal(
    detectCsServiceEscalation(message),
    null,
    `${message} should not be escalated.`,
  );
}

console.log("Cross-industry CS service escalation regression tests passed.");
