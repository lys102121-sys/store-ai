import { requireAuthenticatedUser } from "@/app/lib/auth";

type PatchBody = {
  question?: unknown;
  answer?: unknown;
  category?: unknown;
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

function normalizeCategory(value: unknown) {
  if (typeof value !== "string") return "general";

  const category = value.trim();

  return allowedCategories.has(category) ? category : "general";
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

  if (!question || !answer) {
    return Response.json(
      { error: "Question and answer are required." },
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

  const { data, error } = await auth.supabase
    .from("store_knowledge_items")
    .update({
      question,
      answer,
      category: normalizeCategory(body.category),
      confidence: "owner_confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
    )
    .maybeSingle();

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
