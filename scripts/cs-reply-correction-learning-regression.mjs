import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const caseIntakePath = path.join(projectRoot, "app/lib/csCaseIntake.ts");
const learningPath = path.join(
  projectRoot,
  "app/lib/csReplyCorrectionLearning.ts",
);

function transpile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
}

const caseSandbox = { exports: {}, console };
vm.runInNewContext(transpile(caseIntakePath), caseSandbox, {
  filename: caseIntakePath,
});

const learningSandbox = {
  exports: {},
  require(specifier) {
    if (specifier.includes("csCaseIntake")) return caseSandbox.exports;
    return {};
  },
  console,
};
vm.runInNewContext(transpile(learningPath), learningSandbox, {
  filename: learningPath,
});

const {
  buildCsReplyCorrectionPrompt,
  applyCsReplyCorrectionSafetyGuard,
  findRepeatedCsReplyCorrectionPattern,
  hasMeaningfulCsReplyCorrection,
  sanitizeCsCorrectionText,
  selectRelevantCsReplyCorrections,
} = learningSandbox.exports;

assert.equal(
  hasMeaningfulCsReplyCorrection(
    "정확한 안내를 위해 확인 후 말씀드리겠습니다.",
    "정확한 안내를 위해 확인 후 말씀드리겠습니다!",
  ),
  false,
);
assert.equal(
  hasMeaningfulCsReplyCorrection(
    "바로 환불해드리겠습니다.",
    "주문 상태와 환불 기준을 확인한 뒤 안내드리겠습니다.",
  ),
  true,
);

const sanitized = sanitizeCsCorrectionText(
  "주문번호 A-123456, 30,000원이며 010-1234-5678로 연락 주세요. https://example.com",
);
assert.doesNotMatch(sanitized, /A-123456|30,000|010-1234-5678|example\.com/);
assert.match(sanitized, /\[식별정보\]|\[금액\]|\[연락처\]|\[링크\]/);

const corrections = [
  {
    id: "correction-1",
    user_id: "user-1",
    source_type: "cs_message",
    source_id: "1",
    customer_message: "소스가 빠졌어요.",
    ai_reply: "바로 보내드리겠습니다.",
    owner_reply: "주문 내용을 확인한 뒤 안내드리겠습니다.",
    sanitized_customer_message: "소스가 빠졌어요.",
    sanitized_ai_reply: "바로 보내드리겠습니다.",
    sanitized_owner_reply: "주문 내용을 확인한 뒤 안내드리겠습니다.",
    case_type: "request_mismatch",
    source_platform: "baemin",
    status: "active",
  },
  {
    id: "correction-2",
    user_id: "user-1",
    source_type: "cs_message",
    source_id: "2",
    customer_message: "케이크 가격이 얼마인가요?",
    ai_reply: "가격은 30,000원입니다.",
    owner_reply: "가격을 확인한 뒤 안내드리겠습니다.",
    sanitized_customer_message: "케이크 가격이 얼마인가요?",
    sanitized_ai_reply: "가격은 [금액]입니다.",
    sanitized_owner_reply: "가격을 확인한 뒤 안내드리겠습니다.",
    case_type: "information_request",
    source_platform: "manual",
    status: "active",
  },
];

const mismatchCorrections = selectRelevantCsReplyCorrections(
  "메뉴 하나가 누락됐어요.",
  corrections,
);
assert.equal(mismatchCorrections.length, 1);
assert.equal(mismatchCorrections[0].id, "correction-1");

assert.equal(
  selectRelevantCsReplyCorrections("영업시간이 언제인가요?", corrections)
    .length,
  0,
  "Unrelated information requests must not reuse a price correction.",
);

const prompt = buildCsReplyCorrectionPrompt("소스가 누락됐어요.", corrections);
assert.match(prompt, /사장님이 수정한 유사 답변 학습/);
assert.match(prompt, /사실·정책 근거가 아니라/);
assert.match(prompt, /절대 재사용하지 마세요/);

const pricePrompt = buildCsReplyCorrectionPrompt(
  "케이크 가격을 알려주세요.",
  corrections,
);
assert.match(pricePrompt, /\[금액\]/);
assert.doesNotMatch(pricePrompt, /30,000/);

const repeatedPattern = findRepeatedCsReplyCorrectionPattern(
  "케이크 가격을 알려주세요.",
  [
    corrections[1],
    {
      ...corrections[1],
      id: "correction-3",
      source_id: "3",
      customer_message: "딸기 케이크 얼마인가요?",
      sanitized_customer_message: "딸기 케이크 얼마인가요?",
    },
  ],
  new Date("2026-06-15T00:00:00.000Z"),
);
assert.equal(repeatedPattern.correctionCount, 2);

const guardedDecision = applyCsReplyCorrectionSafetyGuard({
  customerMessage: "케이크 가격을 알려주세요.",
  decision: {
    reply: "가격을 안내드립니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
    aiReason: "등록된 정보가 있습니다.",
  },
  corrections: [
    corrections[1],
    {
      ...corrections[1],
      id: "correction-3",
      source_id: "3",
      customer_message: "딸기 케이크 얼마인가요?",
      sanitized_customer_message: "딸기 케이크 얼마인가요?",
    },
  ],
  now: new Date("2026-06-15T00:00:00.000Z"),
});
assert.equal(guardedDecision.handlingType, "needs_review");
assert.equal(guardedDecision.riskLevel, "normal");
assert.equal(guardedDecision.guardType, "correction_learning");
assert.match(guardedDecision.aiReason, /최근 2회 수정/);

const singleCorrectionDecision = applyCsReplyCorrectionSafetyGuard({
  customerMessage: "케이크 가격을 알려주세요.",
  decision: {
    reply: "가격을 안내드립니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
    aiReason: "등록된 정보가 있습니다.",
  },
  corrections: [corrections[1]],
});
assert.equal(singleCorrectionDecision.handlingType, "auto_ready");

const expiredCorrectionDecision = applyCsReplyCorrectionSafetyGuard({
  customerMessage: "케이크 가격을 알려주세요.",
  decision: {
    reply: "가격을 안내드립니다.",
    handlingType: "auto_ready",
    riskLevel: "low",
    aiReason: "등록된 정보가 있습니다.",
  },
  corrections: [
    { ...corrections[1], updated_at: "2025-01-01T00:00:00.000Z" },
    {
      ...corrections[1],
      source_id: "old-2",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
  ],
  now: new Date("2026-06-15T00:00:00.000Z"),
});
assert.equal(expiredCorrectionDecision.handlingType, "auto_ready");

const csRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-reply/route.ts"),
  "utf8",
);
const csPatchRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-messages/[id]/route.ts"),
  "utf8",
);
const platformProcessing = fs.readFileSync(
  path.join(projectRoot, "app/lib/platformInquiryProcessing.ts"),
  "utf8",
);
const mockPlatformInquiries = fs.readFileSync(
  path.join(projectRoot, "app/lib/mockPlatformInquiries.ts"),
  "utf8",
);
const coupangInquiriesRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/integrations/coupang/inquiries/route.ts"),
  "utf8",
);

assert.match(csRoute, /loadCsReplyCorrections/);
assert.match(csRoute, /buildCsReplyCorrectionPrompt/);
assert.match(csRoute, /replyCorrections,/);
assert.match(csRoute, /decision\.guardType !== "correction_learning"/);
assert.match(csRoute, /cs_reply_auto_completion_paused/);
assert.match(csRoute, /correctionLearningPaused/);
assert.match(csPatchRoute, /recordCsReplyCorrection/);
assert.match(platformProcessing, /buildCsReplyCorrectionPrompt/);
assert.match(platformProcessing, /decision\.guardType !== "correction_learning"/);
assert.match(mockPlatformInquiries, /platform_inquiries_auto_completion_paused/);
assert.match(coupangInquiriesRoute, /platform_inquiries_auto_completion_paused/);

console.log("CS reply correction learning regression tests passed.");
