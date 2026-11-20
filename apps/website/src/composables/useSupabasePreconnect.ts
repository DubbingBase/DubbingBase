/**
 * Preconnects to the Supabase storage origin for pages whose images (voice actor portraits,
 * studio logos) are served from it. Skipped in dev where images go through the `/supabase` proxy.
 */
export function useSupabasePreconnect() {
  const { supabaseUrl } = useRuntimeConfig().public;
  if (import.meta.dev || !supabaseUrl || !URL.canParse(supabaseUrl)) return;
  useHead({ link: [{ rel: "preconnect", href: new URL(supabaseUrl).origin }] });
}
