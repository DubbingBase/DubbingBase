export default defineTask({
  meta: {
    name: "enqueue-trending-media",
    description: "Enqueues the daily trending movies and TV shows",
  },
  async run(event) {
    const taskContext: unknown = event?.context;
    const cloudflare = isRecord(taskContext) ? Reflect.get(taskContext, "cloudflare") : undefined;
    const cloudflareEnv = isRecord(cloudflare) ? Reflect.get(cloudflare, "env") : undefined;
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();
    const secretKey =
      (typeof config.supabaseSecretKey === "string" ? config.supabaseSecretKey : "") ||
      getRecordString(cloudflareEnv, "SUPABASE_SECRET_KEY") ||
      getRecordString(cloudflareEnv, "NUXT_SUPABASE_SECRET_KEY") ||
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const result = value[key];
  return typeof result === "string" ? result : undefined;
}
