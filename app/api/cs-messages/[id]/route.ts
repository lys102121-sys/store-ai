import { requireAuthenticatedUser } from "@/app/lib/auth";

const validStatuses = new Set(["pending", "needs_review", "completed", "answered"]);

type PatchBody = {
  reply?: unknown;
  status?: unknown;
};

function buildMissingStatusColumnResponse(detail: string) {
  return Response.json(
    {
      error:
        "cs_messages 테이블에 status 컬럼이 필요합니다. Supabase SQL editor에서 `alter table cs_messages add column if not exists status text default 'pending';`를 실행해 주세요.",
      detail,
    },
    { status: 500 },
  );
}

function buildMissingHandlingColumnsResponse(detail: string) {
  return Response.json(
    {
      error:
        "cs_messages 테이블에 handling_type, risk_level 컬럼이 필요합니다. Supabase SQL editor에서 `alter table cs_messages add column if not exists handling_type text default 'needs_approval'; alter table cs_messages add column if not exists risk_level text default 'normal';`을 실행해 주세요.",
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
    return Response.json(
      { error: "CS message id is required." },
      { status: 400 },
    );
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
    const { data: existingCsMessage, error: existingCsMessageError } =
      await auth.supabase
        .from("cs_messages")
        .select("source_platform, external_id, platform_status")
        .eq("id", id)
        .eq("user_id", auth.userId)
        .maybeSingle();

    if (existingCsMessageError) {
      if (
        !/(source_platform|external_id|platform_status)/i.test(
          existingCsMessageError.message,
        )
      ) {
        return Response.json(
          {
            error: "Failed to load CS message platform source.",
            detail: existingCsMessageError.message,
          },
          { status: 500 },
        );
      }
    } else {
      const externalId =
        typeof existingCsMessage?.external_id === "string"
          ? existingCsMessage.external_id.trim()
          : "";
      const requiresCoupangReplyRegistration =
        existingCsMessage?.source_platform === "coupang" &&
        externalId &&
        !externalId.startsWith("mock-coupang");

      if (requiresCoupangReplyRegistration) {
        return Response.json(
          {
            error:
              "Coupang inquiries must be completed through the Coupang reply registration API.",
          },
          { status: 409 },
        );
      }

      payload.platform_status =
        existingCsMessage?.source_platform &&
        existingCsMessage.source_platform !== "manual"
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
    .from("cs_messages")
    .update(payload)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select(
      "id, customer_message, reply, status, handling_type, risk_level, source_platform, external_id, external_url, platform_status, created_at",
    )
    .single();

  if (error) {
    if (
      /(source_platform|external_id|external_url|platform_status)/i.test(
        error.message,
      )
    ) {
      const legacyPayload = { ...payload };
      delete legacyPayload.platform_status;
      const fallback = await auth.supabase
        .from("cs_messages")
        .update(legacyPayload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select(
          "id, customer_message, reply, status, handling_type, risk_level, created_at",
        )
        .single();

      if (!fallback.error) {
        return Response.json({ csMessage: fallback.data });
      }
    }

    if (/(handling_type|risk_level)/i.test(error.message)) {
      console.warn(
        "cs_messages handling columns are missing. Run: alter table cs_messages add column if not exists handling_type text default 'needs_approval'; alter table cs_messages add column if not exists risk_level text default 'normal';",
      );
      const fallback = await auth.supabase
        .from("cs_messages")
        .update(payload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select("id, customer_message, reply, status, created_at")
        .single();

      if (!fallback.error) {
        return Response.json({ csMessage: fallback.data });
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
        .from("cs_messages")
        .update({ reply: payload.reply })
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select("id, customer_message, reply, created_at")
        .single();

      if (!fallback.error) {
        return Response.json({ csMessage: fallback.data });
      }
    }

    return Response.json(
      { error: "Failed to update CS message.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ csMessage: data });
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
    return Response.json(
      { error: "CS message id is required." },
      { status: 400 },
    );
  }

  const { data: csMessage, error: csMessageError } = await auth.supabase
    .from("cs_messages")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (csMessageError) {
    return Response.json(
      { error: "Failed to load CS message.", detail: csMessageError.message },
      { status: 500 },
    );
  }

  if (!csMessage) {
    return Response.json(
      { error: "CS message not found or not owned by current user." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await auth.supabase
    .from("cs_messages")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (deleteError) {
    return Response.json(
      { error: "Failed to delete CS message.", detail: deleteError.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
