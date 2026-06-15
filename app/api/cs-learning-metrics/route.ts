import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  buildCsLearningMetrics,
  createEmptyCsLearningMetrics,
  type CsReplyCorrectionMetricRow,
} from "@/app/lib/csLearningMetrics";
import { csReplyCorrectionsSql } from "@/app/lib/csReplyCorrectionLearning";

function isMissingCorrectionTableError(error: { message?: string } | null) {
  return Boolean(
    error &&
      /cs_reply_corrections|schema cache|does not exist/i.test(
        error.message ?? "",
      ),
  );
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [generated30d, generatedRecent7d, generatedPrevious7d, corrections] =
    await Promise.all([
      auth.supabase
        .from("cs_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .gte("created_at", thirtyDaysAgo.toISOString()),
      auth.supabase
        .from("cs_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .gte("created_at", sevenDaysAgo.toISOString()),
      auth.supabase
        .from("cs_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .lt("created_at", sevenDaysAgo.toISOString()),
      auth.supabase
        .from("cs_reply_corrections")
        .select(
          "source_id, case_type, sanitized_ai_reply, sanitized_owner_reply, updated_at",
        )
        .eq("user_id", auth.userId)
        .eq("status", "active")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(1000),
    ]);

  const countError =
    generated30d.error ?? generatedRecent7d.error ?? generatedPrevious7d.error;

  if (countError) {
    return Response.json(
      {
        error: "AI CS 학습 품질을 불러오지 못했습니다.",
        detail: countError.message,
      },
      { status: 500 },
    );
  }

  if (corrections.error) {
    if (isMissingCorrectionTableError(corrections.error)) {
      console.warn(
        `cs_reply_corrections table is missing. Run this SQL in Supabase SQL editor: ${csReplyCorrectionsSql}`,
      );
      return Response.json({
        metrics: createEmptyCsLearningMetrics(),
        missingTableSql: csReplyCorrectionsSql,
      });
    }

    return Response.json(
      {
        error: "AI CS 학습 품질을 불러오지 못했습니다.",
        detail: corrections.error.message,
      },
      { status: 500 },
    );
  }

  return Response.json({
    metrics: buildCsLearningMetrics({
      generatedReplies30d: generated30d.count ?? 0,
      generatedRepliesRecent7d: generatedRecent7d.count ?? 0,
      generatedRepliesPrevious7d: generatedPrevious7d.count ?? 0,
      corrections: (corrections.data ?? []) as CsReplyCorrectionMetricRow[],
      now,
    }),
  });
}
