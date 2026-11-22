import { readProperty } from "@app/shared-logic";
import { asString } from "./narrow";

/**
 * Resolves the Supabase secret key used to authenticate internal (cron → route) requests.
 * Looks at the runtime config, then the Cloudflare env bindings, then `process.env`.
 */
export function resolveInternalSecret(runtimeSecret: unknown, cloudflareEnv: unknown): string {
  return (
    asString(runtimeSecret) ||
    asString(readProperty(cloudflareEnv, "SUPABASE_SECRET_KEY")) ||
    asString(readProperty(cloudflareEnv, "NUXT_SUPABASE_SECRET_KEY")) ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NUXT_SUPABASE_SECRET_KEY ||
    ""
  );
}

/** Headers for an internal request, carrying the secret only when one is configured. */
export function internalRequestHeaders(secretKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(secretKey ? { "x-internal-secret": secretKey } : {}),
  };
}
