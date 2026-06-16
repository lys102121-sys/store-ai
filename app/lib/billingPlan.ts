import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingPlanTier = "free" | "paid";

export type BillingPlanStatus = {
  tier: BillingPlanTier;
  isPaid: boolean;
  status: string;
  source: "paid_adoption_requests" | "fallback";
  updatedAt: string | null;
  missingTableSql?: string;
};

export const paidPlanStatusSql = `
-- 결제 시스템 연동 전에는 paid_adoption_requests.status를 플랜 판정 기준으로 사용합니다.
-- 운영자가 상담/결제 완료 후 status를 active, paid, approved, completed, subscribed 중 하나로 바꾸면 유료 플랜으로 해금됩니다.
update paid_adoption_requests
set status = 'active', updated_at = now()
where user_id = '<USER_ID>'
  and source = 'start_onboarding';
`;

const paidStatuses = new Set([
  "active",
  "paid",
  "approved",
  "completed",
  "subscribed",
]);

export function isPaidPlanStatus(status: string | null | undefined) {
  return paidStatuses.has(status?.trim().toLowerCase() ?? "");
}

function createFreePlanStatus(
  overrides: Partial<BillingPlanStatus> = {},
): BillingPlanStatus {
  return {
    tier: "free",
    isPaid: false,
    status: "free_trial",
    source: "fallback",
    updatedAt: null,
    ...overrides,
  };
}

function isMissingPaidAdoptionTableError(error: { message?: string } | null) {
  return Boolean(
    error &&
      /paid_adoption_requests|schema cache|does not exist/i.test(
        error.message ?? "",
      ),
  );
}

type PaidAdoptionPlanRow = {
  status: string | null;
  updated_at: string | null;
};

export async function getBillingPlanStatus({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<BillingPlanStatus> {
  const { data, error } = await supabase
    .from("paid_adoption_requests")
    .select("status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isMissingPaidAdoptionTableError(error)) {
    console.warn(
      `paid_adoption_requests table is missing. Paid plan unlocks will stay in free trial mode until the table exists. SQL hint: ${paidPlanStatusSql}`,
    );

    return createFreePlanStatus({
      missingTableSql: paidPlanStatusSql,
    });
  }

  if (error) {
    throw new Error(error.message);
  }

  const row = data as PaidAdoptionPlanRow | null;
  const status = row?.status?.trim() || "free_trial";
  const isPaid = isPaidPlanStatus(status);

  return {
    tier: isPaid ? "paid" : "free",
    isPaid,
    status,
    source: row ? "paid_adoption_requests" : "fallback",
    updatedAt: row?.updated_at ?? null,
  };
}
