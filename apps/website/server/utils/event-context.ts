import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@app/shared-logic";

interface CloudflareExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Types the keys this server stores on `event.context`. H3 declares the context with an
 * `any` index signature, so without this every read such as
 * `event.context.supabaseAdmin || useSupabaseAdmin(event)` evaluates to `any` and silently
 * drops the Supabase client's types for everything that follows.
 */
declare module "h3" {
  interface H3EventContext {
    /** Pre-resolved service-role client (injected by tests); routes fall back to `useSupabaseAdmin`. */
    supabaseAdmin?: SupabaseClient<Database>;
    /** Authenticated user, cached by `resolveUser`. */
    user?: User;
    /** Prevents a public SSR route with degraded provider data from entering shared cache. */
    disablePublicPageCache?: boolean;
    /** User-scoped client, cached by `resolveUser`. */
    supabase?: SupabaseClient<Database>;
    /** Provided by the Cloudflare Workers runtime. */
    cloudflare?: {
      env?: Record<string, string | undefined>;
      ctx?: CloudflareExecutionContext;
      context?: CloudflareExecutionContext;
    };
  }
}
