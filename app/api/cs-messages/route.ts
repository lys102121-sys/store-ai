import { getSupabase } from "@/app/lib/supabase";

export async function GET() {
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
    .from("cs_messages")
    .select("id, customer_message, reply, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "Failed to fetch CS messages.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ csMessages: data ?? [] });
}
