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

assert.match(pageSource, /오늘의 AI CS 업무 요약/);
assert.match(pageSource, /먼저 확인할 항목/);
assert.match(pageSource, /AI 직원 일지/);
assert.match(pageSource, /성과와 학습 기록/);
assert.doesNotMatch(pageSource, /성과와 자동화 기록/);

assert.match(
  pageSource,
  /className=\{`\$\{cardClass\} order-\[40\] flex flex-col/,
  "운영 관리 상단 카드는 내부 섹션 순서를 제어할 수 있도록 세로 흐름이어야 합니다.",
);

assert.match(
  pageSource,
  /<div className="order-\[20\][\s\S]*?먼저 확인할 항목/,
  "먼저 확인할 항목은 성과 지표보다 먼저 보이는 주요 업무 영역이어야 합니다.",
);

assert.match(
  pageSource,
  /<details className="order-\[30\][\s\S]*?AI 직원 일지/,
  "AI 직원 일지는 오늘 업무 확인 영역 다음에 보여야 합니다.",
);

assert.match(
  pageSource,
  /<details className="order-\[40\][\s\S]*?성과와 학습 기록/,
  "성과와 학습 기록은 오늘 할 일을 본 뒤 펼쳐보는 보조 영역이어야 합니다.",
);

assert.match(pageSource, /오늘 할 일을 처리한 뒤 자동 완료, 절약 시간, 학습 품질/);
assert.match(pageSource, /위험하거나 정보가 부족한 항목부터 위에 보여드립니다/);
assert.match(pageSource, /workflowAttentionActionLabel/);
assert.match(pageSource, /aiStaffDiaryNextAction/);

console.log("Management workflow UX regression tests passed.");
