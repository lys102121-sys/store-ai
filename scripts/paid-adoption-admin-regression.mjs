import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const adminAuthSource = readProjectFile("app/lib/adminAuth.ts");
const supabaseSource = readProjectFile("app/lib/supabase.ts");
const billingPlanSource = readProjectFile("app/lib/billingPlan.ts");
const adminRouteSource = readProjectFile(
  "app/api/admin/paid-adoption-requests/route.ts",
);
const pageSource = readProjectFile("app/page.tsx");
const adminPanelSource = readProjectFile(
  "app/components/dashboard/PaidAdoptionAdminPanel.tsx",
);

assert.match(adminAuthSource, /ADMIN_USER_IDS/);
assert.match(adminAuthSource, /requireAdminUser/);
assert.match(adminAuthSource, /adminSetupHint/);

assert.match(supabaseSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(supabaseSource, /getSupabaseAdmin/);
assert.match(supabaseSource, /persistSession: false/);

assert.match(billingPlanSource, /billing_subscriptions/);
assert.match(billingPlanSource, /billingSubscriptionsSql/);
assert.match(billingPlanSource, /source: "billing_subscriptions"/);
assert.match(billingPlanSource, /paid_adoption_requests/);

assert.match(adminRouteSource, /requireAuthenticatedUser/);
assert.match(adminRouteSource, /requireAdminUser/);
assert.match(adminRouteSource, /getSupabaseAdmin|supabaseAdmin/);
assert.match(adminRouteSource, /\.from\("paid_adoption_requests"\)/);
assert.match(adminRouteSource, /billing_subscriptions/);
assert.match(adminRouteSource, /onConflict: "user_id"/);
assert.match(adminRouteSource, /isPaidPlanStatus\(status\)/);
assert.match(adminRouteSource, /active/);
assert.match(adminRouteSource, /cancelled/);
assert.match(adminRouteSource, /service role|SUPABASE_SERVICE_ROLE_KEY/i);

assert.match(adminPanelSource, /도입 상담 요청 관리/);
assert.match(adminPanelSource, /운영자\/세일즈 담당자/);
assert.match(adminPanelSource, /유료 전환/);
assert.match(adminPanelSource, /상담 중/);

assert.match(pageSource, /PaidAdoptionAdminPanel/);
assert.match(pageSource, /loadAdminPaidAdoptionRequests/);
assert.match(pageSource, /handleAdminPaidAdoptionStatusChange/);
assert.match(pageSource, /\/api\/admin\/paid-adoption-requests/);
assert.match(pageSource, /운영자가 확인 후 도입 범위와 연동 방법/);
assert.match(pageSource, /상담 완료 후 유료 기능 해금/);

console.log("Paid adoption admin regression tests passed.");
