import { requireAuthenticatedUser } from "@/app/lib/auth";
import { aiActivityLogSql } from "@/app/lib/aiActivityLog";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("ai_activity_logs")
    .select(
      "id, event_type, title, description, related_type, related_id, status, handling_type, risk_level, source_platform, metadata, created_at",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (/ai_activity_logs|schema cache|does not exist/i.test(error.message)) {
      console.warn(
        `ai_activity_logs table is missing. Run this SQL in Supabase SQL editor: ${aiActivityLogSql}`,
      );
      return Response.json({
        logs: [],
        missingTableSql: aiActivityLogSql,
      });
    }

    return Response.json(
      {
        error: "Failed to fetch AI activity logs.",
        detail: error.message,
      },
      { status: 500 },
    );
  }

  return Response.json({ logs: data ?? [] });
}
