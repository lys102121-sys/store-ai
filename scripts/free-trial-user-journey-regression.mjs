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
const freeTrialLimitsSource = readProjectFile("app/lib/freeTrialLimits.ts");
const freeTrialUsageSource = readProjectFile("app/lib/freeTrialUsage.ts");
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

const trialJourneySteps = [
  "예시 가게를 준비합니다",
  "샘플 문의가 처리함에 생깁니다",
  "승인 완료를 눌러봅니다",
];

assert.match(pageSource, /무료 체험은 이렇게 진행됩니다/);
for (const step of trialJourneySteps) {
  assert.match(pageSource, new RegExp(step.replace(/[${}]/g, "\\$&")));
}
assert.match(pageSource, /학습 입력과 샘플 데이터는 무료/);
assert.match(pageSource, /샘플 데이터와 가게 지식 학습은 이 카운트에서 제외합니다/);
assert.match(
  pageSource,
  /실제 플랫폼 문의 가져오기와 답변 등록은 유료 플랜 또는\s+도입 상담 후 연결할 핵심 기능/,
);
assert.match(pageSource, /유료 플랜으로 AI CS 직원을 운영 중입니다/);
assert.match(pageSource, /유료 플랜 운영 시작 체크리스트/);
assert.match(pageSource, /무료 답변 한도는 해제되었습니다/);
assert.match(pageSource, /유료 기능 활성화/);
assert.match(pageSource, /가게 지식 최종 확인/);
assert.match(pageSource, /플랫폼 연동 열기/);
assert.match(pageSource, /자동 처리 설정 보기/);
assert.match(pageSource, /처리함 보기/);
assert.match(pageSource, /id="auto-processing-settings"/);
assert.match(pageSource, /현재 상태/);
assert.match(pageSource, /답변 생성 제한이 해제/);
assert.doesNotMatch(pageSource, /학습 신호/);
assert.doesNotMatch(pageSource, /무료로 열어둘 것/);
assert.doesNotMatch(pageSource, /유료 전환 후보/);
assert.doesNotMatch(pageSource, /최근 30일 절감 가치/);
assert.doesNotMatch(pageSource, /도입 가치는 절감액으로 판단할 수 있어요/);

assert.match(pageSource, /AI CS 직원 3분 체험하기/);
assert.match(pageSource, /handleStartThreeMinuteDemo/);
assert.match(pageSource, /\/api\/integrations\/smartstore\/mock-inquiries/);
assert.match(pageSource, /setSelectedWorkflowPlatform\("smartstore"\)/);
assert.match(pageSource, /setSelectedWorkflowStatus\("pending"\)/);
assert.match(pageSource, /승인 대기 카드에서 AI 답변 초안/);
assert.match(startOnboardingSource, /유료 도입 상담/);
assert.doesNotMatch(startOnboardingSource, /metricLabel/);
assert.doesNotMatch(startOnboardingSource, /metricValue/);

assert.match(freeTrialLimitsSource, /FREE_TRIAL_AI_REPLY_LIMIT = 30/);
assert.match(freeTrialLimitsSource, /FREE_TRIAL_BATCH_REVIEW_LIMIT = 10/);
assert.match(freeTrialLimitsSource, /FREE_TRIAL_LIMIT_REACHED_MESSAGE/);
assert.match(pageSource, /freeTrialAiReplyLimitReached/);
assert.match(pageSource, /freeTrialAiReplyNearlyUsed/);
assert.match(pageSource, /answerGenerationBlocked/);
assert.match(pageSource, /generationBlocked=\{answerGenerationBlocked\}/);
assert.match(pageSource, /reviews\.length > trialAiReplyRemainingCount/);
assert.match(pageSource, /무료 체험 남은 AI 답변 생성/);
assert.match(pageSource, /freeTrialNearlyUsedTitle/);
assert.match(pageSource, /무료 답변 \$\{trialAiReplyRemainingCount\.toLocaleString/);
assert.match(pageSource, /운영을 계속하려면 지금 도입 상담을 요청하세요/);
assert.match(pageSource, /연동 범위와 유료 전환을 같이 정리해드립니다/);

assert.match(freeTrialUsageSource, /checkFreeTrialAiReplyCapacity/);
assert.match(freeTrialUsageSource, /createFreeTrialLimitResponse/);
assert.match(freeTrialUsageSource, /startsWith\("mock-"\)/);
assert.match(freeTrialUsageSource, /FREE_TRIAL_LIMIT_REACHED_MESSAGE/);
assert.match(freeTrialUsageSource, /plan\.isPaid/);
assert.match(billingPlanSource, /isPaidPlanStatus/);
assert.match(billingPlanSource, /paid_adoption_requests/);
assert.match(billingStatusRouteSource, /freeTrialUsage/);
assert.match(billingStatusRouteSource, /platformIntegrations/);
assert.match(pageSource, /쿠팡 실제 연동/);
assert.match(pageSource, /스마트스토어 준비/);
assert.match(pageSource, /배달앱 샘플\/수요 확인/);
assert.match(pageSource, /실제 연동 우선/);
assert.match(pageSource, /다음 연동 후보/);
assert.match(pageSource, /id: "coupang"[\s\S]*?id: "smartstore"/);
assert.match(pageSource, /지금은 쿠팡 실제 문의 연동을 가장 먼저 연결/);
assert.match(pageSource, /스마트스토어 연동 설정/);
assert.match(pageSource, /스마트스토어 설정 열기/);
assert.match(pageSource, /platform: "smartstore"/);
assert.match(pageSource, /handleSaveSmartstoreCredentials/);
assert.match(pageSource, /스마트스토어 연동 설정이 저장되었습니다/);
assert.match(pageSource, /handleTestSmartstoreConnection/);
assert.match(pageSource, /\/api\/integrations\/smartstore\/test/);
assert.match(pageSource, /스마트스토어 연결 테스트/);
assert.match(pageSource, /handleImportSmartstoreInquiries/);
assert.match(pageSource, /\/api\/integrations\/smartstore\/inquiries/);
assert.match(pageSource, /스마트스토어 문의 가져오기/);
assert.match(pageSource, /가져온 문의는 AI가 답변 초안과/);
assert.match(platformCredentialsRouteSource, /normalizeCredentialPlatform/);
assert.match(platformCredentialsRouteSource, /value === "smartstore"/);
assert.match(platformCredentialsRouteSource, /platform,/);
assert.match(platformCredentialsRouteSource, /onConflict: "user_id,platform"/);
assert.match(pageSource, /!isDemoExternalId\(item\.externalId\)/);
assert.match(pageSource, /!isPaidPlan && freeTrialAiReplyLimitReached/);
assert.match(pageSource, /!isPaidPlan && reviews\.length > trialAiReplyRemainingCount/);
assert.match(pageSource, /무료 체험 중에는 설정을 미리 저장할 수 있지만/);
assert.match(workflowInboxControlsSource, /유료 플랜에서 일괄 승인/);

assertBefore(
  csReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "CS 답변 API는 가게 정보 조회와 답변 생성 전에 무료 사용량을 확인해야 합니다.",
);
assertBefore(
  reviewReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "리뷰 답글 API는 가게 정보 조회와 답변 생성 전에 무료 사용량을 확인해야 합니다.",
);
assertBefore(
  batchReviewReplyRouteSource,
  /checkFreeTrialAiReplyCapacity/,
  /\.from\("stores"\)/,
  "일괄 리뷰 API는 가게 정보 조회와 답변 생성 전에 무료 사용량을 확인해야 합니다.",
);
assert.match(batchReviewReplyRouteSource, /requestedReplies: reviews\.length/);
assert.match(csReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(reviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(batchReviewReplyRouteSource, /createFreeTrialLimitResponse/);
assert.match(csReplyRouteSource, /capacity\.isPaidPlan && storeRow\.auto_complete_low_risk_cs/);
assert.match(reviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(batchReviewReplyRouteSource, /capacity\.isPaidPlan && storeSettings\.auto_complete_positive_reviews/);
assert.match(coupangInquiriesRouteSource, /paid_plan_required/);
assert.match(coupangReplyRouteSource, /externalId\.startsWith\("mock-coupang"\)/);
assert.match(coupangReplyRouteSource, /paid_plan_required/);

assert.match(pageSource, /handleRequestPaidAdoption/);
assert.match(pageSource, /\/api\/paid-adoption-requests/);
assert.match(paidAdoptionRouteSource, /paid_adoption_requests/);
assert.match(paidAdoptionRouteSource, /onConflict: "user_id,source"/);
assert.match(pageSource, /도입 상담 요청이 저장되었습니다/);

console.log("Free trial user journey regression tests passed.");
