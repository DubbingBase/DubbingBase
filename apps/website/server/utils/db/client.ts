import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@app/shared-logic";

let adminClient: SupabaseClient<Database> | null = null;

export function useSupabaseAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    const config = useRuntimeConfig();
    const url =
      (config.supabaseUrl as string) ||
      process.env.SUPABASE_URL ||
      process.env.NUXT_SUPABASE_URL ||
      "";
    const key =
      (config.supabaseSecretKey as string) ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      "";
    if (!url) {
      const envKeys = Object.keys(process.env)
        .filter((k) => /supabase|nux/i.test(k))
        .join(",");
      throw new Error(
        `Supabase URL is not configured. Env keys present: [${envKeys || "none"}]`,
      );
    }
    adminClient = createClient<Database>(url, key);
  }
  return adminClient;
}
