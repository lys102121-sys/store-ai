import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const platformInquiryPath = path.join(
  projectRoot,
  "app/lib/platformInquiry.ts",
);
const source = fs.readFileSync(platformInquiryPath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };

vm.runInNewContext(transpiled, sandbox, { filename: platformInquiryPath });

const {
  buildPlatformInquiryKnowledgeText,
  buildPlatformInquiryPromptContext,
  createNormalizedPlatformInquiry,
  isMockPlatformInquiry,
} = sandbox.exports;

const inquiry = createNormalizedPlatformInquiry({
  sourcePlatform: "smartstore",
  externalId: " inquiry-123 ",
  content: " 배송은 언제 시작되나요? ",
  productName: " 생활용품 세트 ",
  createdAt: " 2026-06-14T10:00:00.000Z ",
  externalUrl: " https://example.com/inquiries/123 ",
});

assert.equal(inquiry.sourcePlatform, "smartstore");
assert.equal(inquiry.externalId, "inquiry-123");
assert.equal(inquiry.content, "배송은 언제 시작되나요?");
assert.equal(inquiry.productName, "생활용품 세트");
assert.equal(
  buildPlatformInquiryKnowledgeText(inquiry),
  "생활용품 세트\n배송은 언제 시작되나요?",
);
assert.match(buildPlatformInquiryPromptContext(inquiry), /생활용품 세트/);
assert.match(buildPlatformInquiryPromptContext(inquiry), /smartstore/);
assert.equal(isMockPlatformInquiry(inquiry), false);
assert.equal(
  isMockPlatformInquiry({ externalId: "mock-baemin-inquiry-1" }),
  true,
);

assert.throws(() =>
  createNormalizedPlatformInquiry({
    sourcePlatform: "coupang",
    externalId: "",
    content: "문의 내용",
    productName: null,
    createdAt: null,
    externalUrl: null,
  }),
);

const coupangRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/integrations/coupang/inquiries/route.ts"),
  "utf8",
);
const smartstoreRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/integrations/smartstore/inquiries/route.ts"),
  "utf8",
);
const smartstoreOpenApi = fs.readFileSync(
  path.join(projectRoot, "app/lib/smartstoreOpenApi.ts"),
  "utf8",
);
const mockInquiryUtility = fs.readFileSync(
  path.join(projectRoot, "app/lib/mockPlatformInquiries.ts"),
  "utf8",
);
const platformInquiryProcessing = fs.readFileSync(
  path.join(projectRoot, "app/lib/platformInquiryProcessing.ts"),
  "utf8",
);
const manualCsReplyRoute = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-reply/route.ts"),
  "utf8",
);

for (const integrationSource of [
  coupangRoute,
  smartstoreRoute,
  mockInquiryUtility,
]) {
  assert.match(integrationSource, /preparePlatformInquiryForStorage/);
  assert.doesNotMatch(integrationSource, /openai\.responses\.create/);
  assert.doesNotMatch(integrationSource, /buildCsReplySystemPrompt/);
  assert.doesNotMatch(integrationSource, /resolveCsWorkflowStatus/);
  assert.doesNotMatch(integrationSource, /selectRelevantStoreKnowledgeItems/);
}

assert.match(smartstoreRoute, /parseSmartstoreProductInquiries/);
assert.match(smartstoreRoute, /source_platform", "smartstore"/);
assert.match(smartstoreRoute, /requestSmartstoreAccessToken/);
assert.match(smartstoreRoute, /fetchSmartstoreProductInquiries/);
assert.match(smartstoreRoute, /Failed to check existing Smartstore inquiries/);

assert.match(smartstoreOpenApi, /SMARTSTORE_OPEN_API_HOST/);
assert.match(smartstoreOpenApi, /\/v1\/oauth2\/token/);
assert.match(smartstoreOpenApi, /\/v1\/contents\/qnas/);
assert.match(smartstoreOpenApi, /client_secret_sign/);
assert.match(smartstoreOpenApi, /bcrypt/);
assert.match(smartstoreOpenApi, /questionId/);
assert.match(smartstoreOpenApi, /productName/);

assert.match(platformInquiryProcessing, /generatePlatformInquiryDecision/);
assert.match(platformInquiryProcessing, /createPlatformCsMessageRow/);
assert.match(platformInquiryProcessing, /resolveCsWorkflowStatus/);
assert.match(platformInquiryProcessing, /selectRelevantStoreKnowledgeItems/);

assert.match(manualCsReplyRoute, /generateCsReplyDecision/);
assert.doesNotMatch(manualCsReplyRoute, /openai\.responses\.create/);
assert.doesNotMatch(manualCsReplyRoute, /buildCsReplySystemPrompt/);
assert.doesNotMatch(manualCsReplyRoute, /applyOperationalInfoGuard/);
assert.doesNotMatch(manualCsReplyRoute, /applyCsServiceEscalation/);

console.log("Platform inquiry pipeline regression tests passed.");
