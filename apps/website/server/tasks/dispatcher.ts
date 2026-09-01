export default defineTask({
  meta: {
    name: "dispatcher",
    description:
      "Cron dispatcher task that orchestrates fast 10s tasks and 1m heavy extraction tasks",
  },
  async run(event) {
    const cf = (event?.context as any)?.cloudflare;
    const cfCtx = cf?.ctx || cf?.context;
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();

    const secretKey =
      (config.supabaseSecretKey as string) ||
      cf?.env?.SUPABASE_SECRET_KEY ||
      cf?.env?.NUXT_SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(secretKey ? { "x-internal-secret": secretKey } : {}),
    };

    const dispatchTask = (
      queueName: "wiki_discovery" | "wiki_check" | "wiki_extract",
    ) => {
      const taskPromise = nitroApp
        .localFetch("/api/process-media-queue", {
          method: "POST",
          headers,
          body: { queue: queueName },
          context: event?.context,
        })
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.warn(
              `[Dispatcher] Queue ${queueName} returned status ${res.status}: ${errText}`,
            );
          } else {
            console.log(
              `[Dispatcher] Queue ${queueName} completed successfully.`,
            );
          }
        })
        .catch((err) => {
          console.error(
            `[Dispatcher] Error processing queue ${queueName}:`,
            err,
          );
        });

      if (cfCtx && typeof cfCtx.waitUntil === "function") {
        cfCtx.waitUntil(taskPromise);
      } else if (typeof (event as any)?.waitUntil === "function") {
        (event as any).waitUntil(taskPromise);
      }
    };

    // Throughput budget per minute (cron fires every 60s):
    //   - wiki_extract (LLM/Gemini): once per minute from external service, keep at
    //     iteration 0 to avoid hammering the LLM rate limit.
    //   - wiki_discovery + wiki_check (TMDB + Wikipedia): every ~3s in parallel.
    //     Limits (verified 2026): TMDB ~40 req/s; Wikipedia (compliant User-Agent)
    //     = 200 req/min hard cap + 3 concurrent requests etiquette. Each check/discovery
    //     item costs ~1-2 TMDB calls and 1-3 Wikipedia calls (most cache hits, TTL 24h-7d).
    //     36 items/min worst-case ≈ 72-108 fresh wiki calls/min < 200 cap.
    // ponytail: hardcoded 3s pacing + 18 rounds; raise CONCURRENCY/rounds if throughput matters
    const ROUNDS = 18;
    const PACING_MS = 3000;

    console.log(
      `[Dispatcher] Starting 1-minute cron cycle (${ROUNDS}x ${PACING_MS}ms iterations)...`,
    );

    for (let i = 0; i < ROUNDS; i++) {
      // 1. Dispatch heavy 1-minute extraction task only on the very first iteration
      if (i === 0) {
        dispatchTask("wiki_extract");
      }

      // 2. Dispatch fast tasks in parallel on every iteration
      dispatchTask("wiki_discovery");
      dispatchTask("wiki_check");

      // Throttle pacing so TMDB/Wikipedia stay within their rate limits
      if (i < ROUNDS - 1) {
        await new Promise((resolve) => setTimeout(resolve, PACING_MS));
      }
    }

    console.log(`[Dispatcher] Finished dispatching all ${ROUNDS} iterations.`);
    return { result: "success" };
  },
});
