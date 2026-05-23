import { requireAuthenticatedUser } from "@/app/lib/auth";

type RequestBody = {
  store_name?: unknown;
  business_type?: unknown;
  tone?: unknown;
  shipping_policy?: unknown;
  refund_policy?: unknown;
  product_name?: unknown;
  product_description?: unknown;
  product_details?: unknown;
  product_caution?: unknown;
  extra_faq?: unknown;
  owner_reply_examples?: unknown;
};

const storeSelectColumns =
  "id, user_id, store_name, business_type, tone, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, extra_faq, owner_reply_examples, created_at, updated_at";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (
    typeof body.store_name !== "string" ||
    (body.business_type !== undefined &&
      typeof body.business_type !== "string") ||
    typeof body.tone !== "string" ||
    typeof body.shipping_policy !== "string" ||
    typeof body.refund_policy !== "string" ||
    typeof body.product_name !== "string" ||
    typeof body.product_description !== "string" ||
    typeof body.product_details !== "string" ||
    typeof body.product_caution !== "string" ||
    typeof body.extra_faq !== "string" ||
    typeof body.owner_reply_examples !== "string"
  ) {
    return Response.json(
      {
        error:
          "store_name, business_type, tone, shipping_policy, refund_policy, and product fields must all be strings.",
      },
      { status: 400 },
    );
  }

  const store_name = body.store_name.trim();
  const business_type =
    typeof body.business_type === "string" ? body.business_type.trim() : "";
  const tone = body.tone.trim();
  const shipping_policy = body.shipping_policy.trim();
  const refund_policy = body.refund_policy.trim();
  const product_name = body.product_name.trim();
  const product_description = body.product_description.trim();
  const product_details = body.product_details.trim();
  const product_caution = body.product_caution.trim();
  const extra_faq = body.extra_faq.trim();
  const owner_reply_examples = body.owner_reply_examples.trim();

  if (!store_name) {
    return Response.json(
      { error: "store_name must be a non-empty string." },
      { status: 400 },
    );
  }

  const savedAt = new Date().toISOString();
  const storePayload = {
    store_name,
    business_type,
    tone,
    shipping_policy,
    refund_policy,
    product_name,
    product_description,
    product_details,
    product_caution,
    extra_faq,
    owner_reply_examples,
    updated_at: savedAt,
  };

  const { data: existingStore, error: existingStoreError } = await auth.supabase
    .from("stores")
    .select("id")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingStoreError) {
    return Response.json(
      {
        error: "Failed to load existing store.",
        detail: existingStoreError.message,
      },
      { status: 500 },
    );
  }

  const query = existingStore
    ? auth.supabase
        .from("stores")
        .update(storePayload)
        .eq("id", existingStore.id)
        .eq("user_id", auth.userId)
        .select(storeSelectColumns)
        .single()
    : auth.supabase
        .from("stores")
        .insert({
          user_id: auth.userId,
          ...storePayload,
          created_at: savedAt,
        })
        .select(storeSelectColumns)
        .single();

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { error: "Failed to save store.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ store: data }, { status: existingStore ? 200 : 201 });
}
