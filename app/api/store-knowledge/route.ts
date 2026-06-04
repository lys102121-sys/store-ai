import { requireAuthenticatedUser } from "@/app/lib/auth";

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
