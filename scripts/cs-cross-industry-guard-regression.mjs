import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csOperationalInfo.ts");
const workflowClaimGuardPath = path.join(
  projectRoot,
  "app/lib/csWorkflowClaimGuard.ts",
);

function loadWorkflowClaimGuard() {
  const source = fs.readFileSync(workflowClaimGuardPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = { exports: {}, console };

  vm.runInNewContext(transpiled, sandbox, {
    filename: workflowClaimGuardPath,
  });

  return sandbox.exports;
}

function loadCsOperationalInfo() {
  const workflowClaimGuard = loadWorkflowClaimGuard();
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
      if (specifier.includes("csWorkflowClaimGuard")) {
        return workflowClaimGuard;
      }
      return {};
    },
    console,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

  return sandbox.exports;
}

const {
  applyOperationalInfoGuard,
  findMissingOperationalInfo,
} = loadCsOperationalInfo();

function createStore(overrides = {}) {
  return {
    user_id: "user-1",
    store_name: "\ud14c\uc2a4\ud2b8 \uac00\uac8c",
    business_type: "\ud14c\uc2a4\ud2b8 \uc5c5\uc885",
    shipping_policy: "",
    refund_policy: "",
    product_name: "",
    product_description: "",
    product_details: "",
    product_caution: "",
    product_catalog: "",
    extra_faq: "",
    owner_cs_examples: "",
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function expectNeedsReviewWithoutGuessing({
  businessType,
  customerMessage,
  expectedQuestionPart,
}) {
  const store = createStore({ business_type: businessType });
  const missingInfo = findMissingOperationalInfo(customerMessage, store);

  assert.ok(missingInfo, `${customerMessage} should create missing info.`);
  assert.equal(missingInfo.topic, "product_option");
  assert.ok(
    missingInfo.question.includes(expectedQuestionPart),
    `${customerMessage} missing info question should include ${expectedQuestionPart}. Actual: ${missingInfo.question}`,
  );

  const guard = applyOperationalInfoGuard({
    customerMessage,
    reply: "\uac00\ub2a5\ud569\ub2c8\ub2e4. \uc694\uccad\uc0ac\ud56d\uc5d0 \ub0a8\uaca8\uc8fc\uc138\uc694.",
    store,
  });

  assert.ok(guard, `${customerMessage} should be guarded.`);
  assert.equal(guard.handlingType, "needs_review");
  assert.equal(guard.riskLevel, "normal");
  assert.match(guard.reply, /\uc815\ud655\ud55c \uc548\ub0b4\ub97c \uc704\ud574 \ud655\uc778 \ud6c4 \ub2e4\uc2dc \ub9d0\uc500\ub4dc\ub9ac\uaca0\uc2b5\ub2c8\ub2e4/);
  assert.doesNotMatch(guard.reply, /\uac00\ub2a5\ud569\ub2c8\ub2e4|\uc694\uccad\uc0ac\ud56d|\uc81c\uacf5\ub429\ub2c8\ub2e4|\ud3ec\ud568\ub429\ub2c8\ub2e4/);
}

[
  {
    businessType: "\ubbf8\uc6a9\uc2e4",
    customerMessage: "\uc5fc\uc0c9\uc57d \ubcc0\uacbd\ub418\ub098\uc694?",
    expectedQuestionPart: "\uc5fc\uc0c9\uc57d \ubcc0\uacbd",
  },
  {
    businessType: "\ud559\uc6d0",
    customerMessage: "\ubcf4\uac15 \uc218\uc5c5 \uac00\ub2a5\ud55c\uac00\uc694?",
    expectedQuestionPart: "\ubcf4\uac15 \uc218\uc5c5",
  },
  {
    businessType: "\uc219\ubc15",
    customerMessage: "\uc5bc\ub9ac\uccb4\ud06c\uc778 \uac00\ub2a5\ud55c\uac00\uc694?",
    expectedQuestionPart: "\uc5bc\ub9ac\uccb4\ud06c\uc778",
  },
  {
    businessType: "\uacf5\ubc29",
    customerMessage: "\ub3c4\uc548 \ubcc0\uacbd \uac00\ub2a5\ud55c\uac00\uc694?",
    expectedQuestionPart: "\ub3c4\uc548 \ubcc0\uacbd",
  },
  {
    businessType: "\ubc30\ub2ec \uc74c\uc2dd\uc810",
    customerMessage: "\uc18c\uc2a4 \ucd94\uac00 \uac00\ub2a5\ud55c\uac00\uc694?",
    expectedQuestionPart: "\uc18c\uc2a4 \ucd94\uac00",
  },
  {
    businessType: "\ub80c\ud0c8",
    customerMessage: "\uc124\uce58\ube44\ub3c4 \ud3ec\ud568\uc778\uac00\uc694?",
    expectedQuestionPart: "\uc124\uce58\ube44",
  },
  {
    businessType: "\uc804\uc790\uc81c\ud488",
    customerMessage: "\ucda9\uc804\uae30\ub3c4 \ud3ec\ud568\uc778\uac00\uc694?",
    expectedQuestionPart: "\ucda9\uc804\uae30",
  },
].forEach(expectNeedsReviewWithoutGuessing);

const explicitOptionStore = createStore({
  business_type: "\ubc30\ub2ec \uc74c\uc2dd\uc810",
  extra_faq: "\uc18c\uc2a4 \ucd94\uac00\ub294 1\uac1c\uae4c\uc9c0 \ubb34\ub8cc\ub85c \uac00\ub2a5\ud569\ub2c8\ub2e4.",
});

assert.equal(
  findMissingOperationalInfo("\uc18c\uc2a4 \ucd94\uac00 \uac00\ub2a5\ud55c\uac00\uc694?", explicitOptionStore),
  null,
  "Explicit sauce-addition knowledge should allow the AI to answer.",
);

console.log("Cross-industry CS guard regression tests passed.");
