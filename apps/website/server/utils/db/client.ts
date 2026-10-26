import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@app/shared-logic";

let adminClient: SupabaseClient<Database> | null = null;

export function useSupabaseAdmin(event?: any): SupabaseClient<Database> {
  if (!adminClient) {
    const config = event ? useRuntimeConfig(event) : useRuntimeConfig();
    const cfEnv = event?.context?.cloudflare?.env;
    const url =
      (config.supabaseUrl as string) ||
      cfEnv?.SUPABASE_URL ||
      cfEnv?.NUXT_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NUXT_SUPABASE_URL ||
      "";
    const key =
      (config.supabaseSecretKey as string) ||
      cfEnv?.SUPABASE_SECRET_KEY ||
      cfEnv?.NUXT_SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      "";
    if (!url) {
      throw new Error(
        "Supabase URL is not configured. Set NUXT_SUPABASE_URL or supabaseUrl in runtimeConfig.",
      );
    }
    adminClient = createClient<Database>(url, key);
  }
  return adminClient;
}
