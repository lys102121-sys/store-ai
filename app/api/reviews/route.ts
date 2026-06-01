import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const primary = await auth.supabase
    .from("reviews")
    .select(
      "id, review, reply, sentiment, status, handling_type, risk_level, ai_reason, source_platform, external_id, external_url, platform_status, created_at",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  let data: unknown[] | null = primary.data;
  let error = primary.error;

  if (isMissingAiReasonColumnError(error)) {
    warnMissingAiReasonColumns();
    const fallback = await auth.supabase
      .from("reviews")
      .select(
        "id, review, reply, sentiment, status, handling_type, risk_level, source_platform, external_id, external_url, platform_status, created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (
    error &&
    /(source_platform|external_id|external_url|platform_status)/i.test(
      error.message,
    )
  ) {
    const fallback = await auth.supabase
      .from("reviews")
      .select(
        "id, review, reply, sentiment, status, handling_type, risk_level, created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error && /(handling_type|risk_level)/i.test(error.message)) {
    const fallback = await auth.supabase
      .from("reviews")
      .select("id, review, reply, sentiment, status, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error && /status/i.test(error.message)) {
    const fallback = await auth.supabase
      .from("reviews")
      .select("id, review, reply, sentiment, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return Response.json(
      { error: "Failed to fetch reviews.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ reviews: data ?? [] });
}
