import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function loadTsModule(relativePath, mocks = {}) {
  const sourcePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const sandbox = {
    exports: loadedModule.exports,
    module: loadedModule,
    console,
    require(specifier) {
      if (mocks[specifier]) return mocks[specifier];
      throw new Error(`Unexpected import ${specifier}`);
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

  return loadedModule.exports;
}

const riskSignals = loadTsModule("app/lib/riskSignals.ts");
const {
  buildAiCsAgentRuntimeInstruction,
  buildAiCsAgentRuntimePlan,
} = loadTsModule("app/lib/aiCsAgentRuntime.ts", {
  "@/app/lib/riskSignals": riskSignals,
});

const missingPricePlan = buildAiCsAgentRuntimePlan({
  surface: "cs_reply",
  text: "케이크 얼마인가요?",
  hasMissingInfo: true,
});

assert.equal(missingPricePlan.manager.surface, "cs_reply");
assert.equal(missingPricePlan.manager.complexity, "medium");
assert.equal(missingPricePlan.manager.shouldCheckExistingImplementation, true);
assert.equal(missingPricePlan.failureChecklist.noOperationalGuessing, true);
assert.equal(missingPricePlan.failureChecklist.ownerKnowledgeBoundary, true);
assert.ok(missingPricePlan.experts.includes("cs_safety"));
assert.ok(missingPricePlan.experts.includes("store_knowledge"));
assert.ok(
  missingPricePlan.builder.verificationCommands.includes("npm run test:cs-guard"),
);
assert.ok(
  missingPricePlan.builder.verificationCommands.includes("npm run test:learning"),
);

const allergyPlan = buildAiCsAgentRuntimePlan({
  surface: "review_reply",
  text: "먹고 알레르기 반응이 생겼어요.",
});

assert.equal(allergyPlan.manager.complexity, "high");
assert.equal(allergyPlan.failureChecklist.highRiskEscalation, true);
assert.ok(allergyPlan.experts.includes("cs_safety"));

const platformPlan = buildAiCsAgentRuntimePlan({
  surface: "platform_inquiry_import",
  sourcePlatform: "coupang",
  text: "오늘 출고되나요?",
});

assert.equal(platformPlan.manager.revenueImpact, true);
assert.equal(platformPlan.failureChecklist.platformStatusSafety, true);
assert.ok(platformPlan.experts.includes("platform"));
assert.ok(
  platformPlan.builder.verificationCommands.includes(
    "npm run test:workflow-safety",
  ),
);

const monetizationPlan = buildAiCsAgentRuntimePlan({
  surface: "monetization",
  touchesPaidGate: true,
});

assert.equal(monetizationPlan.failureChecklist.paidGateSafety, true);
assert.ok(monetizationPlan.experts.includes("monetization"));
assert.ok(
  monetizationPlan.builder.verificationCommands.includes(
    "npm run test:monetization",
  ),
);

const instruction = buildAiCsAgentRuntimeInstruction(platformPlan);
assert.match(instruction, /Internal MoAI-ADK route/);
assert.match(instruction, /Manager surface: platform_inquiry_import/);
assert.match(instruction, /Domain experts:/);
assert.match(instruction, /preserve the requested JSON schema/);
assert.match(instruction, /Do not mention this internal route/);

const csGenerationSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/csReplyGeneration.ts"),
  "utf8",
);
const reviewGenerationSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/reviewReplyGeneration.ts"),
  "utf8",
);

assert.match(csGenerationSource, /buildAiCsAgentRuntimePlan/);
assert.match(csGenerationSource, /buildAiCsAgentRuntimeInstruction/);
assert.match(reviewGenerationSource, /buildAiCsAgentRuntimePlan/);
assert.match(reviewGenerationSource, /buildAiCsAgentRuntimeInstruction/);

console.log("AI CS agent runtime regression tests passed.");
