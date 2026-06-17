import { getSupabaseAdmin } from "@/app/lib/supabase";

export const adminSetupHint =
  "Set ADMIN_USER_IDS to a comma-separated list of Supabase user ids, and set SUPABASE_SERVICE_ROLE_KEY on the server.";

export function getAdminUserIds() {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean);
}

export function isAdminUser(userId: string) {
  return getAdminUserIds().includes(userId);
}

export function requireAdminUser(userId: string):
  | {
      supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
    }
  | {
      response: Response;
    } {
  if (!isAdminUser(userId)) {
    return {
      response: Response.json(
        {
          error: "Admin access is required.",
          detail: adminSetupHint,
        },
        { status: 403 },
      ),
    };
  }

  try {
    return { supabaseAdmin: getSupabaseAdmin() };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Admin Supabase setup error.";

    return {
      response: Response.json(
        {
          error: "Admin Supabase client is not configured.",
          detail,
          setupHint: adminSetupHint,
        },
        { status: 500 },
      ),
    };
  }
}
