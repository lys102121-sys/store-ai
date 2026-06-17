import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingPlanTier = "free" | "paid";

export type BillingPlanStatus = {
  tier: BillingPlanTier;
  isPaid: boolean;
  status: string;
  source: "billing_subscriptions" | "paid_adoption_requests" | "fallback";
  updatedAt: string | null;
  missingTableSql?: string;
};

export const billingSubscriptionsSql = `
create table if not exists billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan_tier text not null default 'free',
  status text not null default 'free_trial',
  source text not null default 'manual_admin',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_status_updated_idx
  on billing_subscriptions(status, updated_at desc);

alter table billing_subscriptions enable row level security;

drop policy if exists "Users can read own billing subscription"
  on billing_subscriptions;

create policy "Users can read own billing subscription"
  on billing_subscriptions
  for select
  using (auth.uid() = user_id);
`;

export const paidPlanStatusSql = `
-- 결제 시스템 연동 전에는 billing_subscriptions를 우선 사용하고,
-- 테이블이 없거나 행이 없으면 paid_adoption_requests.status를 임시 플랜 판정 기준으로 사용합니다.
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

function isMissingBillingSubscriptionsTableError(
  error: { message?: string } | null,
) {
  return Boolean(
    error &&
      /billing_subscriptions|schema cache|does not exist/i.test(
        error.message ?? "",
      ),
  );
}

function isPaidBillingSubscription({
  planTier,
  status,
}: {
  planTier: string | null | undefined;
  status: string | null | undefined;
}) {
  const normalizedTier = planTier?.trim().toLowerCase() ?? "";
  const normalizedStatus = status?.trim().toLowerCase() ?? "";

  return (
    ["paid", "pro", "business", "enterprise"].includes(normalizedTier) &&
    ["active", "trialing", "paid", "subscribed"].includes(normalizedStatus)
  );
}

type BillingSubscriptionPlanRow = {
  plan_tier: string | null;
  status: string | null;
  updated_at: string | null;
};

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
  const subscriptionResult = await supabase
    .from("billing_subscriptions")
    .select("plan_tier, status, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingBillingSubscriptionsTableError(subscriptionResult.error)) {
    console.warn(
      `billing_subscriptions table is missing. Falling back to paid_adoption_requests. SQL hint: ${billingSubscriptionsSql}`,
    );
  } else if (subscriptionResult.error) {
    throw new Error(subscriptionResult.error.message);
  } else if (subscriptionResult.data) {
    const subscription = subscriptionResult.data as BillingSubscriptionPlanRow;
    const status = subscription.status?.trim() || "free_trial";
    const isPaid = isPaidBillingSubscription({
      planTier: subscription.plan_tier,
      status,
    });

    return {
      tier: isPaid ? "paid" : "free",
      isPaid,
      status,
      source: "billing_subscriptions",
      updatedAt: subscription.updated_at ?? null,
    };
  }

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
      missingTableSql: `${billingSubscriptionsSql}\n${paidPlanStatusSql}`,
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
