import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const routeSource = readProjectFile("app/api/paid-adoption-requests/route.ts");
const pageSource = readProjectFile("app/page.tsx");
const dashboardTabsSource = readProjectFile(
  "app/components/dashboard/DashboardTabs.tsx",
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
const startOnboardingSource = readProjectFile(
  "app/components/dashboard/StartOnboarding.tsx",
);

assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /export async function GET/);
assert.match(routeSource, /paid_adoption_requests/);
assert.match(routeSource, /unique\(user_id, source\)/);
assert.match(routeSource, /onConflict: "user_id,source"/);
assert.match(routeSource, /\.eq\("source", "start_onboarding"\)/);
assert.match(routeSource, /\.maybeSingle\(\)/);
assert.match(routeSource, /start_onboarding/);
assert.match(routeSource, /workflow_items_30d/);
assert.match(routeSource, /missingTableSql/);

assert.match(pageSource, /handleRequestPaidAdoption/);
assert.match(pageSource, /loadPaidAdoptionRequest/);
assert.match(pageSource, /startPaidAdoptionAction/);
assert.match(pageSource, /paidAdoptionAction=\{startPaidAdoptionAction\}/);
assert.match(pageSource, /\/api\/paid-adoption-requests/);
assert.match(pageSource, /needsReviewSummaryCount/);
assert.match(pageSource, /도입 상담 요청이 저장되었습니다/);
assert.match(pageSource, /요청 접수됨/);
assert.match(pageSource, /상담 진행 중/);
assert.match(pageSource, /유료 기능 열림/);
assert.match(pageSource, /최근 업데이트/);
assert.match(pageSource, /가게 정보 준비하기/);
assert.match(pageSource, /플랫폼 연동 준비하기/);
assert.match(pageSource, /유료 운영 시작하기/);
assert.match(pageSource, /다시 상담 요청/);
assert.match(pageSource, /플랫폼 연동 신청/);
assert.match(pageSource, /실제 플랫폼 연동을 준비하세요/);
assert.match(pageSource, /AI 답변 생성은 유료 도입 후 사용할 수 있습니다/);
assert.doesNotMatch(pageSource, /href=\{paidConsultHref\}/);
assert.doesNotMatch(pageSource, /AI CS 직원 3분 체험하기|handleStartThreeMinuteDemo|무료 체험|무료 AI|무료 답변|샘플 데이터|샘플 문의|샘플 리뷰/);

assert.match(startOnboardingSource, /paidAdoptionAction/);
assert.match(startOnboardingSource, /유료 도입 상담/);
assert.match(startOnboardingSource, /AI CS 직원을 도입하세요/);
assert.match(startOnboardingSource, /도입 상담을 요청합니다/);
assert.match(startOnboardingSource, /가게 지식을 연결합니다/);
assert.match(startOnboardingSource, /AI CS 처리함으로 운영합니다/);
assert.match(startOnboardingSource, /paidAdoptionAction\.highlights/);
assert.match(startOnboardingSource, /paidAdoptionAction\.statusLabel/);
assert.match(startOnboardingSource, /paidAdoptionAction\.statusDescription/);
assert.match(startOnboardingSource, /paidAdoptionAction\.updatedAtLabel/);
assert.match(startOnboardingSource, /paidAdoptionAction\.statusActionLabel/);
assert.match(startOnboardingSource, /paidAdoptionAction\.onStatusAction/);
assert.match(startOnboardingSource, /paidAdoptionAction\.actionLabel/);
assert.match(startOnboardingSource, /item\.description/);
assert.match(startOnboardingSource, /item\.actionLabel/);
assert.match(startOnboardingSource, /onClick=\{item\.onAction\}/);
assert.doesNotMatch(startOnboardingSource, /무료 체험|샘플|3분 체험|metricLabel|metricValue/);

assert.match(pageSource, /actionLabel: authUser \? "도입 상담 요청"/);
assert.match(pageSource, /actionLabel: authUser \? "가게 정보 보기"/);
assert.match(pageSource, /운영자가 도입 범위 확인/);
assert.match(pageSource, /상담 완료 후 유료 기능 해금/);
assert.doesNotMatch(pageSource, /도입 가치는 절감액으로 판단할 수 있어요/);

assert.match(paidAccessLimitsSource, /UNPAID_AI_REPLY_LIMIT = 0/);
assert.match(paidAccessLimitsSource, /UNPAID_BATCH_REVIEW_LIMIT = 0/);
assert.match(paidAccessLimitsSource, /PAID_PLAN_REQUIRED_MESSAGE/);
assert.match(paidAccessLimitsSource, /유료 도입 후 사용할 수 있습니다/);
assert.match(pageSource, /PAID_PLAN_REQUIRED_MESSAGE/);
assert.match(pageSource, /paidPlanRequired/);
assert.match(pageSource, /answerGenerationBlocked/);
assert.match(dashboardTabsSource, /시작하기/);
assert.match(dashboardTabsSource, /플랫폼 연동/);
assert.match(dashboardTabsSource, /답변 작성/);
assert.match(dashboardTabsSource, /운영 관리/);
assert.match(paidAccessUsageSource, /checkFreeTrialAiReplyCapacity/);
assert.match(paidAccessUsageSource, /createFreeTrialLimitResponse/);
assert.match(paidAccessUsageSource, /getBillingPlanStatus/);
assert.match(paidAccessUsageSource, /plan\.isPaid/);
assert.match(billingPlanSource, /paid_adoption_requests/);
assert.match(billingPlanSource, /active/);
assert.match(billingPlanSource, /subscribed/);
assert.match(billingStatusRouteSource, /\/api\/billing\/status|GET/);
assert.match(billingStatusRouteSource, /unlocks/);
assert.match(csReplyRouteSource, /checkFreeTrialAiReplyCapacity/);
assert.match(csReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(csReplyRouteSource, /capacity\.isPaidPlan && storeRow\.auto_complete_low_risk_cs/);
assert.match(reviewReplyRouteSource, /checkFreeTrialAiReplyCapacity/);
assert.match(reviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(reviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(batchReviewReplyRouteSource, /requestedReplies: reviews\.length/);
assert.match(batchReviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(batchReviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(coupangInquiriesRouteSource, /getBillingPlanStatus/);
assert.match(coupangInquiriesRouteSource, /paid_plan_required/);
assert.match(coupangInquiriesRouteSource, /도입 상담을 요청해 연동 범위를 확정/);
assert.match(smartstoreInquiriesRouteSource, /paid_plan_required/);
assert.match(smartstoreInquiriesRouteSource, /도입 상담을 요청해 연동 범위를 확정/);
assert.match(coupangReplyRouteSource, /getBillingPlanStatus/);
assert.match(coupangReplyRouteSource, /paid_plan_required/);

console.log("Paid adoption request regression tests passed.");
