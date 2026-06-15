import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const metricsPath = path.join(projectRoot, "app/lib/csLearningMetrics.ts");
const transpiled = ts.transpileModule(fs.readFileSync(metricsPath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };
vm.runInNewContext(transpiled, sandbox, { filename: metricsPath });

const { buildCsLearningMetrics, calculateReplyChangePercent } = sandbox.exports;
const now = new Date("2026-06-15T00:00:00.000Z");
const metrics = buildCsLearningMetrics({
  generatedReplies30d: 20,
  generatedRepliesRecent7d: 10,
  generatedRepliesPrevious7d: 10,
  corrections: [
    {
      source_id: "1",
      case_type: "information_request",
      sanitized_ai_reply: "가격은 3만원입니다.",
      sanitized_owner_reply: "가격을 확인한 뒤 안내드리겠습니다.",
      updated_at: "2026-06-14T00:00:00.000Z",
    },
    {
      source_id: "2",
      case_type: "information_request",
      sanitized_ai_reply: "바로 보내드리겠습니다.",
      sanitized_owner_reply: "주문 내용을 확인한 뒤 안내드리겠습니다.",
      updated_at: "2026-06-05T00:00:00.000Z",
    },
    {
      source_id: "3",
      case_type: "request_mismatch",
      sanitized_ai_reply: "재배송하겠습니다.",
      sanitized_owner_reply: "누락 내용을 확인한 뒤 안내드리겠습니다.",
      updated_at: "2026-06-04T00:00:00.000Z",
    },
  ],
  now,
});

assert.equal(metrics.correctedReplies30d, 3);
assert.equal(metrics.correctionRate30d, 15);
assert.equal(metrics.recentCorrectionRate7d, 10);
assert.equal(metrics.previousCorrectionRate7d, 20);
assert.equal(metrics.trend, "improving");
assert.equal(metrics.topCorrectionTypes[0].label, "정보 문의");
assert.equal(metrics.topCorrectionTypes[0].count, 2);
assert.ok(metrics.averageChangePercent > 0);
assert.equal(calculateReplyChangePercent("같은 답변", "같은 답변"), 0);

const insufficient = buildCsLearningMetrics({
  generatedReplies30d: 2,
  generatedRepliesRecent7d: 1,
  generatedRepliesPrevious7d: 1,
  corrections: [],
  now,
});
assert.equal(insufficient.trend, "insufficient_data");

const routeSource = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-learning-metrics/route.ts"),
  "utf8",
);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /\.eq\("user_id", auth\.userId\)/);
assert.match(routeSource, /createEmptyCsLearningMetrics/);

console.log("CS learning metrics regression tests passed.");
