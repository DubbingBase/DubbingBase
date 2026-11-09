/**
 * Dev only: the browser talks to Supabase through the same-origin /supabase proxy
 * (nitro.devProxy), so the site works from localhost, Tailscale or the LAN. supabase-js needs
 * an absolute URL, and it must be set before the Supabase module's client plugin reads it.
 */
export default defineNuxtPlugin({
  name: "dev-supabase-proxy",
  enforce: "pre",
  order: -100,
  setup() {
    const config = useRuntimeConfig().public;
    if (!import.meta.dev || !config.devSupabaseProxy) return;
    config.supabase.url = `${location.origin}/supabase`;
  },
});
