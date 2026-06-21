import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const pageSource = readProjectFile("app/page.tsx");
const workflowCardSource = readProjectFile(
  "app/components/dashboard/AiCsWorkflowItemCard.tsx",
);

assert.match(pageSource, /AiCsWorkflowItemCard/);
assert.match(pageSource, /<AiCsWorkflowItemCard/);
assert.doesNotMatch(pageSource, /const workflowCardSectionClass/);
assert.doesNotMatch(pageSource, /const workflowCardDetailClass/);
assert.doesNotMatch(pageSource, /function workflowEvidenceTitle/);
assert.doesNotMatch(pageSource, /function workflowEvidenceMessage/);

assert.match(workflowCardSource, /export function AiCsWorkflowItemCard/);
assert.match(workflowCardSource, /AI 판단 이유/);
assert.match(workflowCardSource, /답변에 참고한 가게 지식/);
assert.match(workflowCardSource, /저장하고 답변에 반영/);
assert.match(workflowCardSource, /승인 완료/);
assert.match(workflowCardSource, /확인 필요로 되돌리기/);
assert.match(workflowCardSource, /데모 데이터/);

console.log("AI CS workflow card component regression tests passed.");
