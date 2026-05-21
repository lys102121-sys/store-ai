import { requireAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("missing_infos")
    .select("id, user_id, question, reason, source_message, status, created_at")
    .eq("user_id", auth.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "Failed to fetch missing infos.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ missingInfos: data ?? [] });
}
