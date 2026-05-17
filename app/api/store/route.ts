import { getSupabase } from "@/app/lib/supabase";

type RequestBody = {
  store_name?: unknown;
  tone?: unknown;
  shipping_policy?: unknown;
  refund_policy?: unknown;
};

export async function POST(request: Request) {
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

  let supabase: ReturnType<typeof getSupabase>;

  try {
    supabase = getSupabase();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase configuration error.";
    return Response.json(
      { error: "Supabase is not configured.", detail: message },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
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
