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
const workflowControlsSource = readProjectFile(
  "app/components/dashboard/AiCsWorkflowInboxControls.tsx",
);
const workflowEmptyStateSource = readProjectFile(
  "app/components/dashboard/AiCsWorkflowInboxEmptyState.tsx",
);
const workflowUiSource = readProjectFile("app/lib/workflowUi.ts");
const storeKnowledgeUiSource = readProjectFile("app/lib/storeKnowledgeUi.ts");

assert.match(pageSource, /AiCsWorkflowItemCard/);
assert.match(pageSource, /<AiCsWorkflowItemCard/);
assert.match(pageSource, /AiCsWorkflowInboxControls/);
assert.match(pageSource, /<AiCsWorkflowInboxControls/);
assert.match(pageSource, /AiCsWorkflowInboxEmptyState/);
assert.match(pageSource, /<AiCsWorkflowInboxEmptyState/);
assert.match(pageSource, /storeKnowledgeCategoryLabel/);
assert.match(pageSource, /storeKnowledgeStatusLabel/);

assert.doesNotMatch(pageSource, /const workflowCardSectionClass/);
assert.doesNotMatch(pageSource, /const workflowCardDetailClass/);
assert.doesNotMatch(pageSource, /function workflowEvidenceTitle/);
assert.doesNotMatch(pageSource, /function workflowEvidenceMessage/);
assert.doesNotMatch(pageSource, /function workflowStatusTabClass/);
assert.doesNotMatch(pageSource, /function storeKnowledgeCategoryLabel/);
assert.doesNotMatch(pageSource, /function storeKnowledgeStatusLabel/);
assert.doesNotMatch(pageSource, /function normalizeStoreKnowledgeStatus/);

assert.match(workflowCardSource, /export function AiCsWorkflowItemCard/);
assert.match(workflowCardSource, /storeKnowledgeCategoryLabel/);
assert.match(workflowCardSource, /workflowEvidenceTitle/);
assert.match(workflowCardSource, /workflowEvidenceMessage/);
assert.match(workflowCardSource, /workflowNextActionMessage/);
assert.match(workflowCardSource, /지금 할 일:/);
assert.match(workflowCardSource, /판단 요약/);
assert.match(workflowCardSource, /AI 판단 이유:/);
assert.match(workflowCardSource, /onResolveMissingInfo/);
assert.match(workflowCardSource, /onDeleteItem/);
assert.doesNotMatch(workflowCardSource, /function storeKnowledgeCategoryLabel/);
assert.doesNotMatch(workflowCardSource, /<p className="font-semibold">AI 판단 이유<\/p>/);

assert.match(workflowControlsSource, /export function AiCsWorkflowInboxControls/);
assert.match(workflowControlsSource, /workflowStatusTabClass/);
assert.match(workflowControlsSource, /onBulkApprove/);

assert.match(workflowEmptyStateSource, /export function AiCsWorkflowInboxEmptyState/);
assert.match(workflowEmptyStateSource, /secondaryActionLabel/);

assert.match(workflowUiSource, /export function workflowStatusLabel/);
assert.match(workflowUiSource, /export function sourcePlatformLabel/);
assert.match(workflowUiSource, /export function workflowStatusTabClass/);

assert.match(storeKnowledgeUiSource, /export function storeKnowledgeCategoryLabel/);
assert.match(storeKnowledgeUiSource, /export function storeKnowledgeStatusLabel/);
assert.match(storeKnowledgeUiSource, /export function storeKnowledgeStatusBadgeClass/);

console.log("AI CS workflow component regression tests passed.");
