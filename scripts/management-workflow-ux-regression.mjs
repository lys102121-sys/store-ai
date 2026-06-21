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

assert.match(pageSource, /오늘의 AI CS 업무 요약/);
assert.match(pageSource, /먼저 확인할 항목/);
assert.match(pageSource, /AI 직원 일지/);
assert.match(pageSource, /성과와 학습 기록/);
assert.doesNotMatch(pageSource, /성과와 자동화 기록/);

assert.match(
  pageSource,
  /className=\{`\$\{cardClass\} order-\[40\] flex flex-col/,
  "The management top card should keep an explicit section order.",
);

assert.match(
  pageSource,
  /<div className="order-\[20\][\s\S]*?먼저 확인할 항목/,
  "Priority items should stay ahead of support details.",
);

assert.match(
  pageSource,
  /<details className="order-\[30\][\s\S]*?AI 직원 일지/,
  "The AI staff diary should remain a collapsible support area.",
);

assert.match(
  pageSource,
  /<details className="order-\[40\][\s\S]*?성과와 학습 기록/,
  "Learning and impact history should remain a secondary collapsible area.",
);

assert.match(pageSource, /먼저 봐야 할 일만 추렸습니다/);
assert.match(pageSource, /위험하거나 정보가 부족한 항목부터 보여드립니다/);
assert.match(pageSource, /오늘 처리 기록/);
assert.match(pageSource, /가게 지식/);
assert.match(pageSource, /AI가 답변에 쓰는 기준표입니다/);
assert.doesNotMatch(pageSource, /지금 처리할 일과 AI가 멈춘 항목만 먼저 보여드립니다/);
assert.doesNotMatch(pageSource, /위험하거나 정보가 부족한 항목부터 위에 보여드립니다/);

assert.match(workflowCardSource, /답변에 필요한 정보가 비어 있어 멈췄습니다/);
assert.match(workflowCardSource, /저장된 정보만으로 답변 가능하다고 판단했습니다/);
assert.match(workflowControlsSource, /바로 답해도 안전한 초안만 한 번에 완료합니다/);

assert.match(pageSource, /workflowAttentionActionLabel/);
assert.match(pageSource, /aiStaffDiaryNextAction/);

console.log("Management workflow UX regression tests passed.");
