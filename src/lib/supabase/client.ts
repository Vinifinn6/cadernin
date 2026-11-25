import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SINGLE_USER_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
export const PROFILE_ASSETS_BUCKET = "profile-assets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes("SEU-PROJETO") &&
    !supabaseAnonKey.includes("sua-chave-publica")
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}
