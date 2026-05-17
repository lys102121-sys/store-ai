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
    .from("stores")
    .select("*")
    .order("id", { ascending: false })
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
