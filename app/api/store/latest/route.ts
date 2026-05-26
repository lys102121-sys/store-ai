import { requireAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("stores")
    .select(
      "user_id, store_name, business_type, tone, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, product_catalog, extra_faq, owner_reply_examples, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
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
