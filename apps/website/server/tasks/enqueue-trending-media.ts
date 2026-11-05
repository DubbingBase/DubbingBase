import { asString } from "../utils/narrow";
interface CloudflareContext {
  env?: Record<string, string | undefined>;
}

export default defineTask({
  meta: {
    name: "enqueue-trending-media",
    description: "Enqueues the daily trending movies and TV shows",
  },
  async run(event) {
    const cf: CloudflareContext | undefined = event?.context?.cloudflare;
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();
    const secretKey =
      asString(config.supabaseSecretKey) ||
      cf?.env?.SUPABASE_SECRET_KEY ||
      cf?.env?.NUXT_SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      "";

    const response = await nitroApp.localFetch("/api/prepare-trending-media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secretKey ? { "x-internal-secret": secretKey } : {}),
      },
      context: event?.context,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Trending media enqueue returned status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    console.log("[Trending Media] Daily enqueue completed:", result);
    return result;
  },
});
