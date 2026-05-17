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
    .from("reviews")
    .select("id, review, reply, sentiment, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "Failed to fetch reviews.", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ reviews: data ?? [] });
}
