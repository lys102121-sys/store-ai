import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assertBefore(source, firstPattern, secondPattern, message) {
  const firstIndex = source.search(firstPattern);
  const secondIndex = source.search(secondPattern);

  assert.notEqual(firstIndex, -1, `${message}: first pattern not found`);
  assert.notEqual(secondIndex, -1, `${message}: second pattern not found`);
  assert.ok(firstIndex < secondIndex, message);
}

const pageSource = readProjectFile("app/page.tsx");
const dashboardTabsSource = readProjectFile(
  "app/components/dashboard/DashboardTabs.tsx",
);
const startOnboardingSource = readProjectFile(
  "app/components/dashboard/StartOnboarding.tsx",
);
const workflowInboxControlsSource = readProjectFile(
  "app/components/dashboard/AiCsWorkflowInboxControls.tsx",
);
const workflowEmptyStateSource = readProjectFile(
  "app/components/dashboard/AiCsWorkflowInboxEmptyState.tsx",
);
const paidAccessLimitsSource = readProjectFile("app/lib/freeTrialLimits.ts");
const paidAccessUsageSource = readProjectFile("app/lib/freeTrialUsage.ts");
const billingPlanSource = readProjectFile("app/lib/billingPlan.ts");
const billingStatusRouteSource = readProjectFile(
  "app/api/billing/status/route.ts",
);
const csReplyRouteSource = readProjectFile("app/api/cs-reply/route.ts");
const reviewReplyRouteSource = readProjectFile("app/api/review-reply/route.ts");
const batchReviewReplyRouteSource = readProjectFile(
  "app/api/review-reply/batch/route.ts",
);
const coupangInquiriesRouteSource = readProjectFile(
  "app/api/integrations/coupang/inquiries/route.ts",
);
const smartstoreInquiriesRouteSource = readProjectFile(
  "app/api/integrations/smartstore/inquiries/route.ts",
);
const coupangReplyRouteSource = readProjectFile(
  "app/api/integrations/coupang/reply/route.ts",
);
const paidAdoptionRouteSource = readProjectFile(
  "app/api/paid-adoption-requests/route.ts",
);
const platformCredentialsRouteSource = readProjectFile(
  "app/api/integrations/credentials/route.ts",
);

const tabLabels = [...dashboardTabsSource.matchAll(/label: "([^"]+)"/g)].map(
  (match) => match[1],
);

assert.deepEqual(
  tabLabels,
  ["시작하기", "가게 설정", "플랫폼 연동", "답변 작성", "운영 관리"],
  "처음 방문자가 보는 탭은 기존 제품 여정 이름과 순서를 유지해야 합니다.",
);

assert.match(startOnboardingSource, /AI CS 직원을 도입하세요/);
assert.match(startOnboardingSource, /도입 상담 · 가게 지식 세팅 · 플랫폼 연동 준비/);
assert.match(startOnboardingSource, /도입 상담을 요청합니다/);
assert.match(startOnboardingSource, /가게 지식을 연결합니다/);
assert.match(startOnboardingSource, /AI CS 처리함으로 운영합니다/);
assert.match(startOnboardingSource, /유료 도입 상담/);
assert.doesNotMatch(startOnboardingSource, /무료 체험|샘플|3분 체험/);

assert.match(pageSource, /id: "integration"/);
assert.match(pageSource, /플랫폼 연동 신청/);
assert.match(pageSource, /실제 플랫폼 연동을 준비하세요/);
assert.match(pageSource, /플랫폼 연동 설정/);
assert.match(pageSource, /paidPlanRequired/);
assert.match(pageSource, /PAID_PLAN_REQUIRED_MESSAGE/);
assert.match(pageSource, /AI 답변 생성은 유료 도입 후 사용할 수 있습니다/);
assert.match(pageSource, /도입 전에는 설정을 미리 저장할 수 있지만/);
assert.match(pageSource, /지금은 쿠팡 실제 문의 연동을 가장 먼저 연결/);
assert.match(pageSource, /배달앱 연동 상담/);
assert.match(pageSource, /실제 플랫폼 문의 가져오기와 답변 등록은 유료 플랜 또는\s+도입 상담 후 연결할 핵심 기능/);
assert.match(pageSource, /스마트스토어 연동 설정/);
assert.match(pageSource, /스마트스토어 문의 가져오기/);
assert.match(pageSource, /쿠팡 Open API 설정/);
assert.match(pageSource, /쿠팡 문의 가져오기/);
assert.match(pageSource, /handleRequestPaidAdoption/);
assert.match(pageSource, /\/api\/paid-adoption-requests/);
assert.match(pageSource, /도입 상담 요청이 저장되었습니다/);

assert.doesNotMatch(pageSource, /handleStartThreeMinuteDemo/);
assert.doesNotMatch(pageSource, /freeTrialPrimaryAction/);
assert.doesNotMatch(pageSource, /trialAiReply/);
assert.doesNotMatch(pageSource, /무료 체험|무료 AI|무료 답변|3분 체험|샘플 데이터로 체험|샘플 리뷰 체험/);
assert.doesNotMatch(pageSource, /\/api\/integrations\/smartstore\/mock-inquiries/);
assert.doesNotMatch(pageSource, /\/api\/integrations\/coupang\/mock-inquiries/);
assert.doesNotMatch(pageSource, /\/api\/integrations\/coupang\/mock-reviews/);
assert.doesNotMatch(pageSource, /\/api\/integrations\/\$\{platform\}\/mock-reviews/);

assert.match(paidAccessLimitsSource, /UNPAID_AI_REPLY_LIMIT = 0/);
assert.match(paidAccessLimitsSource, /PAID_PLAN_REQUIRED_MESSAGE/);
assert.match(paidAccessLimitsSource, /유료 도입 후 사용할 수 있습니다/);
assert.match(paidAccessUsageSource, /checkFreeTrialAiReplyCapacity/);
assert.match(paidAccessUsageSource, /createFreeTrialLimitResponse/);
assert.match(paidAccessUsageSource, /plan\.isPaid/);
assert.match(billingPlanSource, /isPaidPlanStatus/);
assert.match(billingPlanSource, /paid_adoption_requests/);
assert.match(billingStatusRouteSource, /freeTrialUsage/);
assert.match(billingStatusRouteSource, /platformIntegrations/);
assert.match(platformCredentialsRouteSource, /normalizeCredentialPlatform/);
assert.match(platformCredentialsRouteSource, /value === "smartstore"/);
assert.match(platformCredentialsRouteSource, /onConflict: "user_id,platform"/);

assert.match(workflowInboxControlsSource, /유료 도입 후 반복 문의를 한 번에 정리/);
assert.match(workflowEmptyStateSource, /실제 문의와 리뷰가 연결되면/);
assert.doesNotMatch(workflowEmptyStateSource, /샘플/);

assertBefore(
  csReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "CS 답변 API는 가게 정보 조회와 답변 생성 전에 유료 도입 상태를 확인해야 합니다.",
);
assertBefore(
  reviewReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "리뷰 답글 API는 가게 정보 조회와 답변 생성 전에 유료 도입 상태를 확인해야 합니다.",
);
assertBefore(
  batchReviewReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "일괄 리뷰 API는 가게 정보 조회와 답변 생성 전에 유료 도입 상태를 확인해야 합니다.",
);
assert.match(batchReviewReplyRouteSource, /requestedReplies: reviews\.length/);
assert.match(csReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(reviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(batchReviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(csReplyRouteSource, /capacity\.isPaidPlan && storeRow\.auto_complete_low_risk_cs/);
assert.match(reviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(batchReviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(coupangInquiriesRouteSource, /paid_plan_required/);
assert.match(coupangInquiriesRouteSource, /도입 상담을 요청해 연동 범위를 확정/);
assert.match(smartstoreInquiriesRouteSource, /paid_plan_required/);
assert.match(smartstoreInquiriesRouteSource, /도입 상담을 요청해 연동 범위를 확정/);
assert.match(coupangReplyRouteSource, /paid_plan_required/);
assert.match(paidAdoptionRouteSource, /paid_adoption_requests/);
assert.match(paidAdoptionRouteSource, /onConflict: "user_id,source"/);

console.log("Paid-first user journey regression tests passed.");
