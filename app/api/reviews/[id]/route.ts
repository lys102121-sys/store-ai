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
    return Response.json({ error: "Review id is required." }, { status: 400 });
  }

  const { data: review, error: reviewError } = await auth.supabase
    .from("reviews")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (reviewError) {
    return Response.json(
      { error: "Failed to load review.", detail: reviewError.message },
      { status: 500 },
    );
  }

  if (!review) {
    return Response.json(
      { error: "Review not found or not owned by current user." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await auth.supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (deleteError) {
    return Response.json(
      { error: "Failed to delete review.", detail: deleteError.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
