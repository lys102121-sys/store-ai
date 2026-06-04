import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";
import {
  isMissingUsedKnowledgeColumnError,
  warnMissingUsedKnowledgeColumn,
} from "@/app/lib/storeKnowledge";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const primary = await auth.supabase
    .from("cs_messages")
    .select(
      "id, customer_message, reply, status, handling_type, risk_level, ai_reason, used_knowledge_items, source_platform, external_id, external_url, platform_status, created_at",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  let data: unknown[] | null = primary.data;
  let error = primary.error;

  if (isMissingUsedKnowledgeColumnError(error)) {
    warnMissingUsedKnowledgeColumn();
    const fallback = await auth.supabase
      .from("cs_messages")
      .select(
        "id, customer_message, reply, status, handling_type, risk_level, ai_reason, source_platform, external_id, external_url, platform_status, created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (isMissingAiReasonColumnError(error)) {
    warnMissingAiReasonColumns();
    const fallback = await auth.supabase
      .from("cs_messages")
      .select(
        "id, customer_message, reply, status, handling_type, risk_level, source_platform, external_id, external_url, platform_status, created_at",
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
      .from("cs_messages")
      .select(
        "id, customer_message, reply, status, handling_type, risk_level, created_at",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error && /(handling_type|risk_level)/i.test(error.message)) {
    const fallback = await auth.supabase
      .from("cs_messages")
      .select("id, customer_message, reply, status, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error && /status/i.test(error.message)) {
    const fallback = await auth.supabase
      .from("cs_messages")
      .select("id, customer_message, reply, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return Response.json(
      { error: "Failed to fetch CS messages.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ csMessages: data ?? [] });
}
