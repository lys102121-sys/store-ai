import { requireAuthenticatedUser } from "@/app/lib/auth";
import {
  isMissingAiReasonColumnError,
  warnMissingAiReasonColumns,
} from "@/app/lib/aiReasonColumns";

const validStatuses = new Set(["pending", "needs_review", "completed", "answered"]);

type PatchBody = {
  reply?: unknown;
  status?: unknown;
};

function buildMissingStatusColumnResponse(detail: string) {
  return Response.json(
    {
      error:
        "reviews 테이블에 status 컬럼이 필요합니다. Supabase SQL editor에서 `alter table reviews add column if not exists status text default 'pending';`를 실행해 주세요.",
      detail,
    },
    { status: 500 },
  );
}

function buildMissingHandlingColumnsResponse(detail: string) {
  return Response.json(
    {
      error:
        "reviews 테이블에 handling_type, risk_level 컬럼이 필요합니다. Supabase SQL editor에서 `alter table reviews add column if not exists handling_type text default 'needs_approval'; alter table reviews add column if not exists risk_level text default 'normal';`을 실행해 주세요.",
      detail,
    },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Review id is required." }, { status: 400 });
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const payload: { reply?: string; status?: string; platform_status?: string } =
    {};

  if (body.reply !== undefined) {
    if (typeof body.reply !== "string") {
      return Response.json(
        { error: "'reply' must be a string when provided." },
        { status: 400 },
      );
    }

    payload.reply = body.reply.trim();
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !validStatuses.has(body.status)) {
      return Response.json(
        {
          error:
            "'status' must be one of pending, needs_review, completed, answered.",
        },
        { status: 400 },
      );
    }

    payload.status = body.status;
  }

  if (payload.status === "completed") {
    const { data: existingReview, error: existingReviewError } =
      await auth.supabase
        .from("reviews")
        .select("source_platform")
        .eq("id", id)
        .eq("user_id", auth.userId)
        .maybeSingle();

    if (existingReviewError) {
      if (!/source_platform/i.test(existingReviewError.message)) {
        return Response.json(
          {
            error: "Failed to load review platform source.",
            detail: existingReviewError.message,
          },
          { status: 500 },
        );
      }
    } else {
      payload.platform_status =
        existingReview?.source_platform &&
        existingReview.source_platform !== "manual"
          ? "posted"
          : "local";
    }
  }

  if (Object.keys(payload).length === 0) {
    return Response.json(
      { error: "At least one of 'reply' or 'status' is required." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("reviews")
    .update(payload)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select(
      "id, review, reply, sentiment, status, handling_type, risk_level, ai_reason, source_platform, external_id, external_url, platform_status, created_at",
    )
    .single();

  if (error) {
    if (isMissingAiReasonColumnError(error)) {
      warnMissingAiReasonColumns();
      const fallback = await auth.supabase
        .from("reviews")
        .update(payload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select(
          "id, review, reply, sentiment, status, handling_type, risk_level, source_platform, external_id, external_url, platform_status, created_at",
        )
        .single();

      if (!fallback.error) {
        return Response.json({ review: fallback.data });
      }
    }

    if (
      /(source_platform|external_id|external_url|platform_status)/i.test(
        error.message,
      )
    ) {
      const legacyPayload = { ...payload };
      delete legacyPayload.platform_status;
      const fallback = await auth.supabase
        .from("reviews")
        .update(legacyPayload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select(
          "id, review, reply, sentiment, status, handling_type, risk_level, created_at",
        )
        .single();

      if (!fallback.error) {
        return Response.json({ review: fallback.data });
      }
    }

    if (/(handling_type|risk_level)/i.test(error.message)) {
      console.warn(
        "reviews handling columns are missing. Run: alter table reviews add column if not exists handling_type text default 'needs_approval'; alter table reviews add column if not exists risk_level text default 'normal';",
      );
      const fallback = await auth.supabase
        .from("reviews")
        .update(payload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select("id, review, reply, sentiment, status, created_at")
        .single();

      if (!fallback.error) {
        return Response.json({ review: fallback.data });
      }

      if (/(handling_type|risk_level)/i.test(fallback.error.message)) {
        return buildMissingHandlingColumnsResponse(fallback.error.message);
      }
    }

    if (payload.status && /status/i.test(error.message)) {
      return buildMissingStatusColumnResponse(error.message);
    }

    if (!payload.status && payload.reply !== undefined && /status/i.test(error.message)) {
      const fallback = await auth.supabase
        .from("reviews")
        .update({ reply: payload.reply })
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select("id, review, reply, sentiment, created_at")
        .single();

      if (!fallback.error) {
        return Response.json({ review: fallback.data });
      }
    }

    return Response.json(
      { error: "Failed to update review.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ review: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Review id is required." }, { status: 400 });
  }

  const { data: review, error: reviewError } = await auth.supabase
    .from("reviews")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (reviewError) {
    return Response.json(
      { error: "Failed to load review.", detail: reviewError.message },
      { status: 500 },
    );
  }

  if (!review) {
    return Response.json(
      { error: "Review not found or not owned by current user." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await auth.supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (deleteError) {
    return Response.json(
      { error: "Failed to delete review.", detail: deleteError.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
