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
