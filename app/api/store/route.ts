import { requireAuthenticatedUser } from "@/app/lib/auth";

type RequestBody = {
  store_name?: unknown;
  tone?: unknown;
  shipping_policy?: unknown;
  refund_policy?: unknown;
};

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
    typeof body.tone !== "string" ||
    typeof body.shipping_policy !== "string" ||
    typeof body.refund_policy !== "string"
  ) {
    return Response.json(
      {
        error:
          "store_name, tone, shipping_policy, and refund_policy must all be strings.",
      },
      { status: 400 },
    );
  }

  const store_name = body.store_name.trim();
  const tone = body.tone.trim();
  const shipping_policy = body.shipping_policy.trim();
  const refund_policy = body.refund_policy.trim();

  if (!store_name) {
    return Response.json(
      { error: "store_name must be a non-empty string." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("stores")
    .insert({
      user_id: auth.userId,
      store_name,
      tone,
      shipping_policy,
      refund_policy,
    })
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to save store.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ store: data }, { status: 201 });
}
