import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv(): { url: string; anonKey: string } {
  if (!supabaseUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!supabaseAnonKey?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

let browserClient: SupabaseClient | null = null;

/**
 * 브라우저·서버 공용 Supabase 클라이언트 (anon key).
 * Next.js에서는 모듈이 여러 번 로드될 수 있어 브라우저에서는 싱글톤으로 재사용합니다.
 */
export function getSupabase(): SupabaseClient {
  const { url, anonKey } = assertEnv();

  if (typeof window === "undefined") {
    return createClient(url, anonKey);
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey);
  }
  return browserClient;
}

export function getSupabaseWithAuth(accessToken: string): SupabaseClient {
  const { url, anonKey } = assertEnv();

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function getSupabaseAdmin(): SupabaseClient {
  const { url } = assertEnv();

  if (!supabaseServiceRoleKey?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createClient(url, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabase = getSupabase();
