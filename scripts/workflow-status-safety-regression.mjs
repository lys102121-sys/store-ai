import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/workflowStatus.ts");

function loadWorkflowStatus() {
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
  resolveCsWorkflowStatus,
  resolveReviewWorkflowStatus,
} = loadWorkflowStatus();

assert.equal(
  resolveCsWorkflowStatus({
    autoCompleteLowRisk: true,
    handlingType: "auto_ready",
    riskLevel: "low",
  }),
  "completed",
  "Low-risk auto-ready CS can be auto-completed when the owner enables it.",
);

[
  {
    handlingType: "needs_review",
    riskLevel: "low",
    expected: "needs_review",
    label: "CS needing owner review must stay in needs_review.",
  },
  {
    handlingType: "needs_approval",
    riskLevel: "low",
    expected: "pending",
    label: "CS needing approval must not be auto-completed.",
  },
  {
    handlingType: "auto_ready",
    riskLevel: "normal",
    expected: "pending",
    label: "Normal-risk CS must not be auto-completed.",
  },
  {
    handlingType: "auto_ready",
    riskLevel: "high",
    expected: "pending",
    label: "High-risk CS must not be auto-completed.",
  },
].forEach(({ handlingType, riskLevel, expected, label }) => {
  assert.equal(
    resolveCsWorkflowStatus({
      autoCompleteLowRisk: true,
      handlingType,
      riskLevel,
    }),
    expected,
    label,
  );
});

assert.equal(
  resolveCsWorkflowStatus({
    autoCompleteLowRisk: true,
    handlingType: "auto_ready",
    riskLevel: "low",
    hasMissingInfo: true,
  }),
  "needs_review",
  "CS with missing info must stay in needs_review even if it otherwise looks safe.",
);

assert.equal(
  resolveCsWorkflowStatus({
    autoCompleteLowRisk: false,
    handlingType: "auto_ready",
    riskLevel: "low",
  }),
  "pending",
  "Low-risk CS stays pending when auto-complete is disabled.",
);

assert.equal(
  resolveReviewWorkflowStatus({
    autoCompletePositiveReviews: true,
    sentiment: "positive",
    handlingType: "auto_ready",
    riskLevel: "low",
  }),
  "completed",
  "Simple positive low-risk reviews can be auto-completed when enabled.",
);

[
  {
    sentiment: "negative",
    handlingType: "auto_ready",
    riskLevel: "low",
    expected: "pending",
    label: "Negative reviews must not be auto-completed.",
  },
  {
    sentiment: "positive",
    handlingType: "needs_review",
    riskLevel: "low",
    expected: "needs_review",
    label: "Reviews needing owner review must stay in needs_review.",
  },
  {
    sentiment: "positive",
    handlingType: "needs_approval",
    riskLevel: "low",
    expected: "pending",
    label: "Reviews needing approval must not be auto-completed.",
  },
  {
    sentiment: "positive",
    handlingType: "auto_ready",
    riskLevel: "normal",
    expected: "pending",
    label: "Normal-risk reviews must not be auto-completed.",
  },
  {
    sentiment: "positive",
    handlingType: "auto_ready",
    riskLevel: "high",
    expected: "pending",
    label: "High-risk reviews must not be auto-completed.",
  },
].forEach(({ sentiment, handlingType, riskLevel, expected, label }) => {
  assert.equal(
    resolveReviewWorkflowStatus({
      autoCompletePositiveReviews: true,
      sentiment,
      handlingType,
      riskLevel,
    }),
    expected,
    label,
  );
});

assert.equal(
  resolveReviewWorkflowStatus({
    autoCompletePositiveReviews: false,
    sentiment: "positive",
    handlingType: "auto_ready",
    riskLevel: "low",
  }),
  "pending",
  "Positive low-risk reviews stay pending when auto-complete is disabled.",
);

console.log("Workflow status safety regression tests passed.");
