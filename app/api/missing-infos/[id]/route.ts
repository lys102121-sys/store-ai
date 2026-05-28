import { requireAuthenticatedUser } from "@/app/lib/auth";

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
      { error: "Missing info id is required." },
      { status: 400 },
    );
  }

  const { data: missingInfo, error: loadError } = await auth.supabase
    .from("missing_infos")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (loadError) {
    return Response.json(
      { error: "Failed to load missing info.", detail: loadError.message },
      { status: 500 },
    );
  }

  if (!missingInfo) {
    return Response.json(
      { error: "Missing info not found or not owned by current user." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await auth.supabase
    .from("missing_infos")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (deleteError) {
    return Response.json(
      { error: "Failed to delete missing info.", detail: deleteError.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
