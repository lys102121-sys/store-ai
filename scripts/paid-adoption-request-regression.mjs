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
assert.match(pageSource, /actionLabel: authUser \? "도입 상담 요청"/);
assert.match(pageSource, /무료 체험 후 도입 범위 확인/);
assert.doesNotMatch(pageSource, /도입 가치는 절감액으로 판단할 수 있어요/);

console.log("Paid adoption request regression tests passed.");
