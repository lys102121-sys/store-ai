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
const dashboardTabsSource = fs.readFileSync(
  path.join(projectRoot, "app/components/dashboard/DashboardTabs.tsx"),
  "utf8",
);
const freeTrialLimitsSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/freeTrialLimits.ts"),
  "utf8",
);
const freeTrialUsageSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/freeTrialUsage.ts"),
  "utf8",
);
const billingPlanSource = fs.readFileSync(
  path.join(projectRoot, "app/lib/billingPlan.ts"),
  "utf8",
);
const billingStatusRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/billing/status/route.ts"),
  "utf8",
);
const csReplyRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/cs-reply/route.ts"),
  "utf8",
);
const reviewReplyRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/review-reply/route.ts"),
  "utf8",
);
const batchReviewReplyRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/review-reply/batch/route.ts"),
  "utf8",
);
const coupangInquiriesRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/integrations/coupang/inquiries/route.ts"),
  "utf8",
);
const coupangReplyRouteSource = fs.readFileSync(
  path.join(projectRoot, "app/api/integrations/coupang/reply/route.ts"),
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
assert.match(pageSource, /운영자가 도입 범위 확인/);
assert.doesNotMatch(pageSource, /도입 가치는 절감액으로 판단할 수 있어요/);
assert.match(pageSource, /AI CS 직원 3분 체험하기/);
assert.match(pageSource, /handleStartThreeMinuteDemo/);
assert.match(pageSource, /\/api\/integrations\/smartstore\/mock-inquiries/);
assert.match(pageSource, /승인 대기 카드에서 AI 답변 초안/);
assert.match(freeTrialLimitsSource, /FREE_TRIAL_AI_REPLY_LIMIT = 30/);
assert.match(freeTrialLimitsSource, /FREE_TRIAL_BATCH_REVIEW_LIMIT = 10/);
assert.match(freeTrialLimitsSource, /무료 AI 답변 생성 30건을 모두 사용했습니다/);
assert.match(pageSource, /무료 체험은 이렇게 진행됩니다/);
assert.match(pageSource, /AI 답변 30건까지 실제 응대/);
assert.match(pageSource, /학습 입력과 샘플 데이터는 무료/);
assert.match(pageSource, /예시 가게를 준비합니다/);
assert.match(pageSource, /샘플 문의가 처리함에 생깁니다/);
assert.match(pageSource, /승인 완료를 눌러봅니다/);
assert.match(pageSource, /실제 플랫폼 문의 가져오기와 답변 등록은 유료 플랜/);
assert.match(pageSource, /FREE_TRIAL_LIMIT_REACHED_MESSAGE/);
assert.match(pageSource, /freeTrialAiReplyLimitReached/);
assert.match(pageSource, /answerGenerationBlocked/);
assert.match(pageSource, /무료 체험 남은 AI 답변 생성/);
assert.match(pageSource, /freeTrialPrimaryAction/);
assert.match(pageSource, /카카오로 무료 체험 시작/);
assert.match(pageSource, /체험 준비 중/);
assert.match(dashboardTabsSource, /시작하기/);
assert.match(dashboardTabsSource, /플랫폼 연동/);
assert.match(dashboardTabsSource, /답변 작성/);
assert.match(dashboardTabsSource, /운영 관리/);
assert.match(freeTrialUsageSource, /checkFreeTrialAiReplyCapacity/);
assert.match(freeTrialUsageSource, /createFreeTrialLimitResponse/);
assert.match(freeTrialUsageSource, /startsWith\("mock-"\)/);
assert.match(freeTrialUsageSource, /getBillingPlanStatus/);
assert.match(freeTrialUsageSource, /plan\.isPaid/);
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
assert.match(coupangReplyRouteSource, /externalId\.startsWith\("mock-coupang"\)/);
assert.match(coupangReplyRouteSource, /getBillingPlanStatus/);
assert.match(coupangReplyRouteSource, /paid_plan_required/);

console.log("Paid adoption request regression tests passed.");
