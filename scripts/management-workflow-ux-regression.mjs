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
const storeInfoSectionMatch = pageSource.match(
  /<section\s+id="store-info"[\s\S]*?<section\s+id="platform-integrations"/,
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
  /<div className="order-\[30\][\s\S]*?AI 직원 일지/,
  "The AI staff diary should remain a visible support area.",
);

assert.match(
  pageSource,
  /<div className="order-\[40\][\s\S]*?성과와 학습 기록/,
  "Learning and impact history should remain a visible support area.",
);

assert.match(pageSource, /먼저 봐야 할 일만 추렸습니다/);
assert.match(pageSource, /위험하거나 정보가 부족한 항목부터 보여드립니다/);
assert.match(pageSource, /오늘 처리 기록/);
assert.match(pageSource, /운영 보조 도구/);
assert.match(pageSource, /지식 점검과 운영 분석은 아래 섹션에서 바로 확인할 수 있습니다/);
assert.match(pageSource, /가게 지식으로 이동/);
assert.match(pageSource, /분석으로 이동/);
assert.match(pageSource, /가게 지식/);
assert.match(pageSource, /AI가 답변에 쓰는 기준표입니다/);
assert.match(pageSource, /다음 행동/);
assert.match(pageSource, /샘플 데이터로 체험/);
assert.match(pageSource, /문의 답변 테스트/);
assert.match(pageSource, /샘플 리뷰 체험/);
assert.match(pageSource, /지금 확인할 항목이 없습니다/);
assert.match(pageSource, /승인할 답변이 없습니다/);
assert.match(pageSource, /완료된 답변이 없습니다/);
assert.match(pageSource, /문의 하나를 입력하면 AI 답변 초안과 처리 상태가 함께 저장됩니다/);
assert.match(pageSource, /AI가 모르는 질문을 만나면 이곳에 답변 입력 카드가 생깁니다/);
assert.doesNotMatch(pageSource, /지금 처리할 일과 AI가 멈춘 항목만 먼저 보여드립니다/);
assert.doesNotMatch(pageSource, /위험하거나 정보가 부족한 항목부터 위에 보여드립니다/);
assert.doesNotMatch(pageSource, /현재 승인 대기 중인 답변이 없습니다/);
assert.doesNotMatch(pageSource, /toggleManageSupportPanel/);
assert.doesNotMatch(pageSource, /isStoreKnowledgePanelOpen/);
assert.doesNotMatch(pageSource, /isInsightsPanelOpen/);
assert.doesNotMatch(pageSource, /성과와 학습 기록[\s\S]{0,160}펼쳐보세요/);
assert.doesNotMatch(pageSource, /AI 직원 일지[\s\S]{0,220}펼쳐보기/);
assert.ok(storeInfoSectionMatch, "The store settings section should exist.");
assert.doesNotMatch(storeInfoSectionMatch[0], /<details\b/);
assert.doesNotMatch(storeInfoSectionMatch[0], /<summary\b/);
assert.match(storeInfoSectionMatch[0], /선택 입력: 정확도를 높이는 정보/);

assert.match(workflowCardSource, /답변에 필요한 정보가 비어 있어 멈췄습니다/);
assert.match(workflowCardSource, /저장된 정보만으로 답변 가능하다고 판단했습니다/);
assert.doesNotMatch(workflowCardSource, /자세히 보기/);
assert.doesNotMatch(workflowCardSource, /onToggleDetail/);
assert.doesNotMatch(workflowCardSource, /확인 필요로 되돌리기/);
assert.match(workflowControlsSource, /바로 답해도 안전한 초안만 한 번에 완료합니다/);
assert.match(workflowEmptyStateSource, /다음 행동/);
assert.match(workflowEmptyStateSource, /flex flex-col justify-center gap-2 sm:flex-row/);

assert.match(pageSource, /workflowAttentionActionLabel/);
assert.match(pageSource, /aiStaffDiaryNextAction/);

console.log("Management workflow UX regression tests passed.");
