import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export const supabase = getSupabase();
