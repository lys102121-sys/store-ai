import { requireAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("reviews")
    .select("id, review, reply, sentiment, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "Failed to fetch reviews.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ reviews: data ?? [] });
}
