import { getSupabase, getSupabaseWithAuth } from "@/app/lib/supabase";

type AuthenticatedRequest =
  | {
      supabase: ReturnType<typeof getSupabase>;
      userId: string;
    }
  | {
      response: Response;
    };

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedRequest> {
  let supabase: ReturnType<typeof getSupabase>;

  try {
    supabase = getSupabase();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase configuration error.";
    return {
      response: Response.json(
        { error: "Supabase is not configured.", detail: message },
        { status: 500 },
      ),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return {
      response: Response.json(
        { error: "Authentication is required." },
        { status: 401 },
      ),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      response: Response.json(
        {
          error: "Authentication is required.",
          detail: error?.message,
        },
        { status: 401 },
      ),
    };
  }

  return { supabase: getSupabaseWithAuth(token), userId: data.user.id };
}
