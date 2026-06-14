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
const mockInquiryUtility = fs.readFileSync(
  path.join(projectRoot, "app/lib/mockPlatformInquiries.ts"),
  "utf8",
);

for (const integrationSource of [coupangRoute, mockInquiryUtility]) {
  assert.match(integrationSource, /generatePlatformInquiryDecision/);
  assert.match(integrationSource, /createPlatformCsMessageRow/);
  assert.doesNotMatch(integrationSource, /openai\.responses\.create/);
  assert.doesNotMatch(integrationSource, /buildCsReplySystemPrompt/);
}

console.log("Platform inquiry pipeline regression tests passed.");
