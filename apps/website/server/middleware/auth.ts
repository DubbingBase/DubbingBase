import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // Attach supabaseAdmin client to event context (skip during builds/prerender
  // where Supabase may not be configured)
  if (config.supabaseUrl) {
    event.context.supabaseAdmin = useSupabaseAdmin();
  }

  const authHeader = getHeader(event, "authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return;

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
      event.context.supabase = supabase as SupabaseClient;
    }
  } catch (err) {
    console.warn("[Auth Middleware] Failed to resolve user from token:", err);
  }
});
