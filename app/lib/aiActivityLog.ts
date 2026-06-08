import type { SupabaseClient } from "@supabase/supabase-js";

export const aiActivityLogSql = [
  "create table if not exists ai_activity_logs (",
  "  id uuid primary key default gen_random_uuid(),",
  "  user_id uuid not null,",
  "  event_type text not null,",
  "  title text not null,",
  "  description text,",
  "  related_type text,",
  "  related_id text,",
  "  status text,",
  "  handling_type text,",
  "  risk_level text,",
  "  source_platform text default 'manual',",
  "  metadata jsonb default '{}'::jsonb,",
  "  created_at timestamptz default now()",
  ");",
  "create index if not exists ai_activity_logs_user_created_idx on ai_activity_logs(user_id, created_at desc);",
].join(" ");

type AiActivityLogInput = {
  userId: string;
  eventType: string;
  title: string;
  description?: string | null;
  relatedType?: string | null;
  relatedId?: string | number | null;
  status?: string | null;
  handlingType?: string | null;
  riskLevel?: string | null;
  sourcePlatform?: string | null;
  metadata?: Record<string, unknown>;
};

function isMissingAiActivityLogTableError(error: { message?: string } | null) {
  return Boolean(
    error && /ai_activity_logs|schema cache|does not exist/i.test(error.message ?? ""),
  );
}

export async function recordAiActivityLog(
  supabase: SupabaseClient,
  input: AiActivityLogInput,
) {
  const { error } = await supabase.from("ai_activity_logs").insert({
    user_id: input.userId,
    event_type: input.eventType,
    title: input.title,
    description: input.description ?? null,
    related_type: input.relatedType ?? null,
    related_id:
      input.relatedId === undefined || input.relatedId === null
        ? null
        : String(input.relatedId),
    status: input.status ?? null,
    handling_type: input.handlingType ?? null,
    risk_level: input.riskLevel ?? null,
    source_platform: input.sourcePlatform ?? "manual",
    metadata: input.metadata ?? {},
  });

  if (!error) return;

  if (isMissingAiActivityLogTableError(error)) {
    console.warn(
      `ai_activity_logs table is missing. Run this SQL in Supabase SQL editor: ${aiActivityLogSql}`,
    );
    return;
  }

  console.error("Failed to record AI activity log.", error);
}
