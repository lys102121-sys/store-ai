import { requireAdminUser } from "@/app/lib/adminAuth";
import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  billingSubscriptionsSql,
  isPaidPlanStatus,
  paidPlanStatusSql,
} from "@/app/lib/billingPlan";

const selectableColumns =
  "id, user_id, status, source, store_name, estimated_saved_minutes_today, estimated_saved_value_krw_today, estimated_saved_minutes_30d, estimated_saved_value_krw_30d, workflow_items_30d, auto_completed_30d, needs_review_active, platform_items_30d, memo, created_at, updated_at";

export const adminPaidAdoptionRequestsSql = `
-- 운영자 상담 처리함 설정
-- 1) 서버 환경변수 ADMIN_USER_IDS에 운영자 Supabase user id를 쉼표로 등록하세요.
-- 2) 서버 환경변수 SUPABASE_SERVICE_ROLE_KEY를 등록하세요. 브라우저에는 절대 노출하지 마세요.
-- 3) 유료 전환 상태는 billing_subscriptions를 우선 사용합니다.
${billingSubscriptionsSql}

-- 기존 임시 해금 방식도 fallback으로 유지됩니다.
${paidPlanStatusSql}
`;

const allowedStatuses = new Set([
  "requested",
  "contacted",
  "active",
  "paid",
  "approved",
  "completed",
  "subscribed",
  "cancelled",
]);

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

async function requireAdminRequest(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth;
  }

  const admin = requireAdminUser(auth.userId);

  if ("response" in admin) {
    return admin;
  }

  return { userId: auth.userId, supabaseAdmin: admin.supabaseAdmin };
}

export async function GET(request: Request) {
  const admin = await requireAdminRequest(request);

  if ("response" in admin) {
    return admin.response;
  }

  const { data, error } = await admin.supabaseAdmin
    .from("paid_adoption_requests")
    .select(selectableColumns)
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json(
      {
        error: "Failed to fetch paid adoption requests.",
        detail: error.message,
        setupSql: adminPaidAdoptionRequestsSql,
      },
      { status: 500 },
    );
  }

  return Response.json({ requests: data ?? [] });
}

type PatchBody = {
  id?: unknown;
  status?: unknown;
};

function textFromBody(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest(request);

  if ("response" in admin) {
    return admin.response;
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = textFromBody(body.id);
  const status = textFromBody(body.status).toLowerCase();

  if (!id) {
    return Response.json({ error: "Request id is required." }, { status: 400 });
  }

  if (!allowedStatuses.has(status)) {
    return Response.json(
      { error: "Unsupported paid adoption request status." },
      { status: 400 },
    );
  }

  const existing = await admin.supabaseAdmin
    .from("paid_adoption_requests")
    .select(selectableColumns)
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    return Response.json(
      {
        error: "Failed to find paid adoption request.",
        detail: existing.error.message,
      },
      { status: 500 },
    );
  }

  if (!existing.data) {
    return Response.json(
      { error: "Paid adoption request was not found." },
      { status: 404 },
    );
  }

  const updatedAt = new Date().toISOString();
  const updated = await admin.supabaseAdmin
    .from("paid_adoption_requests")
    .update({ status, updated_at: updatedAt })
    .eq("id", id)
    .select(selectableColumns)
    .single();

  if (updated.error) {
    return Response.json(
      {
        error: "Failed to update paid adoption request.",
        detail: updated.error.message,
      },
      { status: 500 },
    );
  }

  let missingBillingTableSql: string | undefined;
  const userId = (existing.data as { user_id?: string }).user_id;
  const shouldUnlockPaidPlan = isPaidPlanStatus(status);

  if (userId) {
    const subscriptionPayload = {
      user_id: userId,
      plan_tier: shouldUnlockPaidPlan ? "paid" : "free",
      status: shouldUnlockPaidPlan
        ? "active"
        : status === "cancelled"
          ? "cancelled"
          : "free_trial",
      source: "paid_adoption_admin",
      updated_at: updatedAt,
    };

    const subscription = await admin.supabaseAdmin
      .from("billing_subscriptions")
      .upsert(subscriptionPayload, { onConflict: "user_id" });

    if (isMissingBillingSubscriptionsTableError(subscription.error)) {
      missingBillingTableSql = billingSubscriptionsSql;
      console.warn(
        `billing_subscriptions table is missing. paid_adoption_requests fallback still works. SQL hint: ${billingSubscriptionsSql}`,
      );
    } else if (subscription.error) {
      return Response.json(
        {
          error: "Paid adoption request was updated, but plan status failed.",
          detail: subscription.error.message,
        },
        { status: 500 },
      );
    }
  }

  return Response.json({
    request: updated.data,
    missingBillingTableSql,
    message: shouldUnlockPaidPlan
      ? "상담 요청을 유료 플랜으로 전환했습니다."
      : "상담 요청 상태를 업데이트했습니다.",
  });
}
