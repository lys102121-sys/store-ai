import { requireAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("stores")
    .select("*")
    .eq("user_id", auth.userId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Failed to fetch store.", detail: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({ error: "No store found." }, { status: 404 });
  }

  return Response.json({ store: data });
}
