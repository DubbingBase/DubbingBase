import { createClient, type User } from "@supabase/supabase-js";
import { createError, getHeader, type H3Event } from "h3";
import { hasSupabaseAuthCookie } from "./auth-session";

/**
 * Resolves the signed-in user lazily, only for handlers that ask for it, so
 * page views and public API reads never pay for `auth.getUser()`.
 *
 * The result is cached on `event.context` (`user` and the user-scoped
 * `supabase` client), which is also how tests inject an authenticated user.
 */
export async function resolveUser(event: H3Event): Promise<User | null> {
  if (event.context.user) return event.context.user;

  const config = useRuntimeConfig(event);
  const authHeader = getHeader(event, "authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (
    !token &&
    !hasSupabaseAuthCookie(getHeader(event, "cookie"), config.public.supabase.cookiePrefix)
  ) {
    return null;
  }

  if (token) {
    const supabase = createClient(config.supabaseUrl, config.public.supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user) {
        event.context.user = user;
        event.context.supabase = supabase;
        return user;
      }
    } catch (error) {
      console.warn("[Auth] Failed to resolve user from token:", error);
    }
  }

  // Fallback: resolve user from session cookies (e.g. browser navigation or SSR)
  try {
    // Loaded on demand: the virtual module is unavailable outside a Nuxt build.
    const { serverSupabaseClient } = await import("#supabase/server");
    const client = await serverSupabaseClient(event);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (!error && user) {
      event.context.user = user;
      event.context.supabase = client;
      return user;
    }
  } catch {
    // Cookie resolution failed or no cookie present; treat as anonymous.
  }

  return null;
}

export async function requireUser(event: H3Event): Promise<User> {
  const user = await resolveUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  return user;
}

export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireUser(event);
  const isAdmin = user.app_metadata?.role === "admin";

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized: Admin access required",
    });
  }
  return user;
}
