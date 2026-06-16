import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const routeSource = fs.readFileSync(
  path.join(projectRoot, "app/api/paid-adoption-requests/route.ts"),
  "utf8",
);
const pageSource = fs.readFileSync(
  path.join(projectRoot, "app/page.tsx"),
  "utf8",
);

assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /paid_adoption_requests/);
assert.match(routeSource, /unique\(user_id, source\)/);
assert.match(routeSource, /onConflict: "user_id,source"/);
assert.match(routeSource, /start_onboarding/);
assert.match(routeSource, /estimated_saved_value_krw_30d/);
assert.match(routeSource, /workflow_items_30d/);
assert.match(routeSource, /missingTableSql/);

assert.match(pageSource, /handleRequestPaidAdoption/);
assert.match(pageSource, /startPaidAdoptionAction/);
assert.match(pageSource, /paidAdoptionAction=\{startPaidAdoptionAction\}/);
assert.match(pageSource, /\/api\/paid-adoption-requests/);
assert.match(pageSource, /recent30EstimatedSavedValueKrw/);
assert.match(pageSource, /needsReviewSummaryCount/);
assert.match(pageSource, /도입 상담 요청이 저장되었습니다/);
assert.doesNotMatch(pageSource, /href=\{paidConsultHref\}/);

const startOnboardingSource = fs.readFileSync(
  path.join(projectRoot, "app/components/dashboard/StartOnboarding.tsx"),
  "utf8",
);
assert.match(startOnboardingSource, /paidAdoptionAction/);
assert.match(startOnboardingSource, /유료 도입 상담/);
assert.match(startOnboardingSource, /paidAdoptionAction\.highlights/);
assert.doesNotMatch(startOnboardingSource, /metricLabel/);
assert.doesNotMatch(startOnboardingSource, /metricValue/);
assert.match(startOnboardingSource, /paidAdoptionAction\.actionLabel/);
assert.match(startOnboardingSource, /item\.description/);
assert.match(startOnboardingSource, /item\.actionLabel/);
assert.match(startOnboardingSource, /onClick=\{item\.onAction\}/);
assert.match(pageSource, /actionLabel: authUser \? "도입 상담 요청"/);
assert.match(pageSource, /actionLabel: authUser \? "가게 정보 보기"/);
assert.match(pageSource, /무료 체험 후 도입 범위 확인/);
assert.doesNotMatch(pageSource, /도입 가치는 절감액으로 판단할 수 있어요/);
assert.match(pageSource, /첫 AI 답변을 바로 만들어보세요/);
assert.match(pageSource, /첫 문의 답변 만들기/);
assert.match(pageSource, /goToTabSection\("answer", "cs-reply"\)/);
assert.match(pageSource, /샘플 데이터로 체험/);
assert.match(pageSource, /FREE_TRIAL_AI_REPLY_LIMIT = 30/);
assert.match(pageSource, /FREE_TRIAL_BATCH_REVIEW_LIMIT = 10/);
assert.match(pageSource, /무료 체험은 AI를 가르치는 시간까지 포함합니다/);
assert.match(pageSource, /샘플 데이터와 가게 지식 학습은 이 카운트에서 제외합니다/);
assert.match(pageSource, /유료 전환 후보/);
assert.match(pageSource, /실제 플랫폼 문의 가져오기와 답변 등록은 유료 플랜/);

console.log("Paid adoption request regression tests passed.");
