import { readPath } from "@app/shared-logic";
import { asString } from "../utils/narrow";

export default defineTask({
  meta: {
    name: "enqueue-trending-media",
    description: "Enqueues the daily trending movies and TV shows",
  },
  async run(event) {
    const cf: unknown = readPath(event, "context", "cloudflare");
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();
    const secretKey =
      asString(config.supabaseSecretKey) ||
      asString(readPath(cf, "env", "SUPABASE_SECRET_KEY")) ||
      asString(readPath(cf, "env", "NUXT_SUPABASE_SECRET_KEY")) ||
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

    const result: unknown = await response.json();
    console.log("[Trending Media] Daily enqueue completed:", result);
    return result;
  },
});
