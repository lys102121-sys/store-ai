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
    store_name: "테스트 상점",
    business_type: "테스트 업종",
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

function expectMissingOperationalInfo({
  customerMessage,
  expectedTopic,
  expectedQuestionPart,
  expectedReplyPattern = /정확한 안내를 위해 확인 후 다시 말씀드리겠습니다/,
  store = createStore(),
}) {
  const missingInfo = findMissingOperationalInfo(customerMessage, store);

  assert.ok(missingInfo, `${customerMessage} should create missing info.`);
  assert.equal(missingInfo.topic, expectedTopic);
  assert.ok(
    missingInfo.question.includes(expectedQuestionPart),
    `${customerMessage} missing info question should include ${expectedQuestionPart}. Actual: ${missingInfo.question}`,
  );

  const guard = applyOperationalInfoGuard({
    customerMessage,
    reply: "임의로 답변한 초안입니다.",
    store,
  });

  assert.ok(guard, `${customerMessage} should be guarded.`);
  assert.equal(guard.handlingType, "needs_review");
  assert.equal(guard.riskLevel, "normal");
  assert.match(guard.reply, expectedReplyPattern);
  assert.doesNotMatch(guard.reply, /제공되지|포함되어 있지|요청사항|가능합니다/);
}

function expectNoMissingOperationalInfo({ customerMessage, store }) {
  const missingInfo = findMissingOperationalInfo(customerMessage, store);

  assert.equal(
    missingInfo,
    null,
    `${customerMessage} should not create missing info when explicit information exists.`,
  );
}

[
  ["케이크 초는 같이 주시나요?", "케이크 초 제공 여부"],
  ["충전기도 포함인가요?", "충전기 포함 여부"],
  ["리본 달아주시나요?", "리본 제공 여부"],
  ["매운맛 조절되나요?", "매운맛 조절 가능 여부"],
  ["각인 가능한가요?", "각인 가능 여부"],
  ["파우치도 동봉되나요?", "파우치 포함 여부"],
].forEach(([customerMessage, expectedQuestionPart]) => {
  expectMissingOperationalInfo({
    customerMessage,
    expectedTopic: "product_option",
    expectedQuestionPart,
  });
});

expectNoMissingOperationalInfo({
  customerMessage: "충전기도 포함인가요?",
  store: createStore({
    extra_faq: "충전기는 기본 포함되어 있습니다.",
  }),
});

expectMissingOperationalInfo({
  customerMessage: "충전기도 포함인가요?",
  expectedTopic: "product_option",
  expectedQuestionPart: "충전기 포함 여부",
  store: createStore({
    extra_faq: "쇼핑백은 제공 가능합니다.",
  }),
});

expectMissingOperationalInfo({
  customerMessage: "케이크 얼마인가요?",
  expectedTopic: "pricing",
  expectedQuestionPart: "케이크 가격",
});

const unsupportedPriceGuard = applyOperationalInfoGuard({
  customerMessage: "케이크 얼마인가요?",
  reply: "케이크 가격은 30,000원입니다.",
  store: createStore(),
});

assert.ok(unsupportedPriceGuard, "Unsupported price claims should be guarded.");
assert.equal(unsupportedPriceGuard.handlingType, "needs_review");
assert.match(
  unsupportedPriceGuard.reply,
  /가격은 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다/,
);
assert.doesNotMatch(unsupportedPriceGuard.reply, /30,000|3만|30000/);

expectNoMissingOperationalInfo({
  customerMessage: "딸기 케이크 얼마인가요?",
  store: createStore({
    product_catalog: "[딸기 생크림 케이크]\n- 1호 30,000원",
  }),
});

expectMissingOperationalInfo({
  customerMessage: "재고 있나요?",
  expectedTopic: "stock",
  expectedQuestionPart: "재고",
});

expectMissingOperationalInfo({
  customerMessage: "오늘 출고되나요?",
  expectedTopic: "shipping_schedule",
  expectedQuestionPart: "출고",
});

expectMissingOperationalInfo({
  customerMessage: "환불 가능한가요?",
  expectedTopic: "refund_exchange",
  expectedQuestionPart: "환불",
});

expectMissingOperationalInfo({
  customerMessage: "제품 전원이 켜지지 않아요.",
  expectedTopic: "service_intake",
  expectedQuestionPart: "확인 및 접수 절차",
  expectedReplyPattern: /상품명과 문제가 발생한 내용/,
});

expectMissingOperationalInfo({
  customerMessage: "제품이 작동하지 않아요.",
  expectedTopic: "service_intake",
  expectedQuestionPart: "확인 및 접수 절차",
  expectedReplyPattern: /상품명과 문제가 발생한 내용/,
});

const serviceIntakeGuard = applyOperationalInfoGuard({
  customerMessage: "구성품이 누락됐어요.",
  reply: "제품 불량이 맞으니 바로 새 상품을 보내드리겠습니다.",
  store: createStore(),
});

assert.ok(serviceIntakeGuard, "Missing components should use the service intake guard.");
assert.equal(serviceIntakeGuard.handlingType, "needs_review");
assert.match(serviceIntakeGuard.reply, /상품명과 문제가 발생한 내용/);
assert.match(serviceIntakeGuard.reply, /사진이나 영상/);
assert.doesNotMatch(serviceIntakeGuard.reply, /제품 불량이 맞|새 상품을 보내/);

expectNoMissingOperationalInfo({
  customerMessage: "제품 전원이 켜지지 않아요.",
  store: createStore({
    extra_faq:
      "고장 문의는 상품명과 증상 영상을 확인한 뒤 A/S 접수를 안내합니다.",
  }),
});

const prematureResolutionGuard = applyOperationalInfoGuard({
  customerMessage: "제품 전원이 켜지지 않아요.",
  reply: "제품 불량이 맞아 새 상품을 보내드리겠습니다.",
  store: createStore({
    extra_faq:
      "고장 문의는 상품명과 증상 영상을 확인한 뒤 A/S 접수를 안내합니다.",
  }),
});

assert.ok(
  prematureResolutionGuard,
  "An intake policy alone must not allow an unverified replacement promise.",
);
assert.equal(prematureResolutionGuard.handlingType, "needs_review");
assert.match(
  prematureResolutionGuard.reply,
  /상품명과 문제가 발생한 내용/,
);
assert.doesNotMatch(
  prematureResolutionGuard.reply,
  /제품 불량이 맞|새 상품을 보내/,
);

const supportedResolutionStore = createStore({
  extra_faq:
    "제품 불량 확인 후 새 상품 교환 출고가 가능합니다. 고장 문의는 증상 영상을 확인한 뒤 접수합니다.",
});

const unsupportedDiagnosisGuard = applyOperationalInfoGuard({
  customerMessage: "제품이 작동하지 않아요.",
  reply: "제품 불량이 맞아 교환이 가능합니다.",
  store: supportedResolutionStore,
});

assert.ok(
  unsupportedDiagnosisGuard,
  "A registered exchange policy must not allow an unverified defect diagnosis.",
);
assert.equal(unsupportedDiagnosisGuard.handlingType, "needs_review");
assert.doesNotMatch(unsupportedDiagnosisGuard.reply, /제품 불량이 맞/);

assert.equal(
  applyOperationalInfoGuard({
    customerMessage: "제품이 작동하지 않아요.",
    reply:
      "증상 확인 후 제품 불량으로 확인되면 새 상품 교환 출고가 가능합니다.",
    store: supportedResolutionStore,
  }),
  null,
  "A conditional resolution explicitly supported by store policy should remain available.",
);

const unverifiedWorkflowGuard = applyOperationalInfoGuard({
  customerMessage: "반품 접수됐나요?",
  reply: "반품 접수가 완료되었습니다.",
  store: createStore({
    refund_policy: "반품 접수 후 상품을 회수하여 상태를 확인합니다.",
  }),
});

assert.ok(
  unverifiedWorkflowGuard,
  "A static policy must not be treated as proof of a completed return request.",
);
assert.equal(unverifiedWorkflowGuard.handlingType, "needs_review");
assert.match(unverifiedWorkflowGuard.reply, /정확한 진행 상태는 확인 후/);
assert.doesNotMatch(unverifiedWorkflowGuard.reply, /접수가 완료/);

console.log("CS operational guard regression tests passed.");
