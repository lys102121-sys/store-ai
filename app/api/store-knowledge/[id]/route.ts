import { requireAuthenticatedUser } from "@/app/lib/auth";

type PatchBody = {
  question?: unknown;
  answer?: unknown;
  category?: unknown;
  status?: unknown;
};

const allowedCategories = new Set([
  "pricing",
  "shipping",
  "refund_exchange",
  "stock",
  "reservation",
  "packaging",
  "allergy_ingredient",
  "product",
  "general",
]);

const allowedStatuses = new Set(["active", "needs_review", "archived"]);

const storeKnowledgeStatusSql =
  "alter table store_knowledge_items add column if not exists status text not null default 'active';";

function isMissingStatusColumnError(error: { message: string } | null) {
  return Boolean(error && /status/i.test(error.message));
}

function warnMissingStatusColumn() {
  console.warn(
    `store_knowledge_items status column is missing. Run: ${storeKnowledgeStatusSql}`,
  );
}

function normalizeCategory(value: unknown) {
  if (typeof value !== "string") return "general";

  const category = value.trim();

  return allowedCategories.has(category) ? category : "general";
}

function normalizeStatus(value: unknown) {
  if (typeof value !== "string") return null;

  const status = value.trim();

  return allowedStatuses.has(status) ? status : null;
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
      { error: "Store knowledge id is required." },
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

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const nextStatus = normalizeStatus(body.status);
  const hasContentUpdate =
    typeof body.question === "string" || typeof body.answer === "string";

  if (hasContentUpdate && (!question || !answer)) {
    return Response.json(
      { error: "Question and answer are required." },
      { status: 400 },
    );
  }

  if (!hasContentUpdate && !nextStatus) {
    return Response.json(
      { error: "Question, answer, or status is required." },
      { status: 400 },
    );
  }

  const { data: existingItem, error: loadError } = await auth.supabase
    .from("store_knowledge_items")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (loadError) {
    return Response.json(
      { error: "Failed to load store knowledge.", detail: loadError.message },
      { status: 500 },
    );
  }

  if (!existingItem) {
    return Response.json(
      { error: "Store knowledge not found or not owned by current user." },
      { status: 404 },
    );
  }

  const updatePayload: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (hasContentUpdate) {
    updatePayload.question = question;
    updatePayload.answer = answer;
    updatePayload.category = normalizeCategory(body.category);
    updatePayload.confidence = "owner_confirmed";
  }

  if (nextStatus) {
    updatePayload.status = nextStatus;
  }

  let { data, error } = await auth.supabase
    .from("store_knowledge_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, status, created_at, updated_at",
    )
    .maybeSingle();

  if (isMissingStatusColumnError(error)) {
    warnMissingStatusColumn();

    if (!hasContentUpdate) {
      return Response.json(
        {
          error:
            "Store knowledge status column is missing. Run the required SQL before changing status.",
          detail: storeKnowledgeStatusSql,
        },
        { status: 500 },
      );
    }

    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.status;
    const fallback = await auth.supabase
      .from("store_knowledge_items")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select(
        "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
      )
      .maybeSingle();

    data = fallback.data
      ? { ...fallback.data, status: nextStatus ?? "active" }
      : null;
    error = fallback.error;
  }

  if (error) {
    return Response.json(
      { error: "Failed to update store knowledge.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ knowledgeItem: data });
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
      { error: "Store knowledge id is required." },
      { status: 400 },
    );
  }

  const { data: existingItem, error: loadError } = await auth.supabase
    .from("store_knowledge_items")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (loadError) {
    return Response.json(
      { error: "Failed to load store knowledge.", detail: loadError.message },
      { status: 500 },
    );
  }

  if (!existingItem) {
    return Response.json(
      { error: "Store knowledge not found or not owned by current user." },
      { status: 404 },
    );
  }

  const { error } = await auth.supabase
    .from("store_knowledge_items")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return Response.json(
      { error: "Failed to delete store knowledge.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
