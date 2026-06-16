import { requireAuthenticatedUser } from "@/app/lib/auth";

export const paidAdoptionRequestsSql = `
create table if not exists paid_adoption_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'requested',
  source text not null default 'ai_cs_value_card',
  store_name text,
  estimated_saved_minutes_today integer not null default 0,
  estimated_saved_value_krw_today integer not null default 0,
  estimated_saved_minutes_30d integer not null default 0,
  estimated_saved_value_krw_30d integer not null default 0,
  workflow_items_30d integer not null default 0,
  auto_completed_30d integer not null default 0,
  needs_review_active integer not null default 0,
  platform_items_30d integer not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source)
);

create index if not exists paid_adoption_requests_status_updated_idx
  on paid_adoption_requests(status, updated_at desc);

alter table paid_adoption_requests enable row level security;

drop policy if exists "Users can manage own paid adoption requests"
  on paid_adoption_requests;

create policy "Users can manage own paid adoption requests"
  on paid_adoption_requests
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
`;

type PaidAdoptionRequestBody = {
  store_name?: unknown;
  estimated_saved_minutes_today?: unknown;
  estimated_saved_value_krw_today?: unknown;
  estimated_saved_minutes_30d?: unknown;
  estimated_saved_value_krw_30d?: unknown;
  workflow_items_30d?: unknown;
  auto_completed_30d?: unknown;
  needs_review_active?: unknown;
  platform_items_30d?: unknown;
  memo?: unknown;
};

function numberFromBody(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function textFromBody(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value.trim() || null : null;
}

function isMissingPaidAdoptionTableError(error: { message?: string } | null) {
  return Boolean(
    error &&
      /paid_adoption_requests|schema cache|does not exist/i.test(
        error.message ?? "",
      ),
  );
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: PaidAdoptionRequestBody;
  try {
    body = (await request.json()) as PaidAdoptionRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = {
    user_id: auth.userId,
    status: "requested",
    source: "ai_cs_value_card",
    store_name: textFromBody(body.store_name),
    estimated_saved_minutes_today: numberFromBody(
      body.estimated_saved_minutes_today,
    ),
    estimated_saved_value_krw_today: numberFromBody(
      body.estimated_saved_value_krw_today,
    ),
    estimated_saved_minutes_30d: numberFromBody(
      body.estimated_saved_minutes_30d,
    ),
    estimated_saved_value_krw_30d: numberFromBody(
      body.estimated_saved_value_krw_30d,
    ),
    workflow_items_30d: numberFromBody(body.workflow_items_30d),
    auto_completed_30d: numberFromBody(body.auto_completed_30d),
    needs_review_active: numberFromBody(body.needs_review_active),
    platform_items_30d: numberFromBody(body.platform_items_30d),
    memo: textFromBody(body.memo),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("paid_adoption_requests")
    .upsert(payload, { onConflict: "user_id,source" })
    .select(
      "id, user_id, status, source, store_name, estimated_saved_minutes_today, estimated_saved_value_krw_today, estimated_saved_minutes_30d, estimated_saved_value_krw_30d, workflow_items_30d, auto_completed_30d, needs_review_active, platform_items_30d, memo, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isMissingPaidAdoptionTableError(error)) {
      console.warn(
        `paid_adoption_requests table is missing. Run this SQL in Supabase SQL editor: ${paidAdoptionRequestsSql}`,
      );
      return Response.json(
        {
          error: "Paid adoption request table is missing.",
          missingTableSql: paidAdoptionRequestsSql,
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        error: "Failed to save paid adoption request.",
        detail: error.message,
      },
      { status: 500 },
    );
  }

  return Response.json(
    {
      request: data,
      message: "도입 상담 요청이 저장되었습니다.",
    },
    { status: 201 },
  );
}
