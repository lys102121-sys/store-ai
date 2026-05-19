import { requireAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("cs_messages")
    .select("id, customer_message, reply, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "Failed to fetch CS messages.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ csMessages: data ?? [] });
}
