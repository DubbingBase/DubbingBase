import { readPath, readProperty } from "@app/shared-logic";
import { internalRequestHeaders, resolveInternalSecret } from "../utils/internal-secret";

export default defineTask({
  meta: {
    name: "enqueue-trending-media",
    description: "Enqueues the daily trending movies and TV shows",
  },
  async run(event) {
    const cf: unknown = readPath(event, "context", "cloudflare");
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();
    const secretKey = resolveInternalSecret(config.supabaseSecretKey, readProperty(cf, "env"));

    const response = await nitroApp.localFetch("/api/prepare-trending-media", {
      method: "POST",
      headers: internalRequestHeaders(secretKey),
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
