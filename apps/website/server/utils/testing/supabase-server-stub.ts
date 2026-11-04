// Vitest-only stand-in for the `#supabase/server` virtual module, which only
// exists inside a Nuxt/Nitro build.
export async function serverSupabaseClient(): Promise<never> {
  throw new Error("serverSupabaseClient is not available in unit tests");
}
