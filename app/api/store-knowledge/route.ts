import { requireAuthenticatedUser } from "@/app/lib/auth";

type PostBody = {
  question?: unknown;
  answer?: unknown;
  category?: unknown;
  sourceId?: unknown;
  sourceText?: unknown;
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

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("store_knowledge_items")
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json(
      { error: "Failed to load store knowledge.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ knowledgeItems: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  let body: PostBody;

  try {
    body = (await request.json()) as PostBody;
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

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select("id")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeError) {
    return Response.json(
      { error: "Failed to load store.", detail: storeError.message },
      { status: 500 },
    );
  }

  if (!store?.id) {
    return Response.json(
      { error: "No store found. Save store settings first, then try again." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const sourceId =
    typeof body.sourceId === "string" && body.sourceId.trim()
      ? body.sourceId.trim()
      : null;
  const sourceText =
    typeof body.sourceText === "string" && body.sourceText.trim()
      ? body.sourceText.trim()
      : null;

  const { data, error } = await auth.supabase
    .from("store_knowledge_items")
    .insert({
      user_id: auth.userId,
      store_id: String(store.id),
      category: normalizeCategory(body.category),
      question,
      answer,
      source_type: "owner_correction",
      source_id: sourceId,
      source_text: sourceText,
      confidence: "owner_confirmed",
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, user_id, store_id, category, question, answer, source_type, source_id, source_text, confidence, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Failed to save store knowledge.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ knowledgeItem: data });
}
