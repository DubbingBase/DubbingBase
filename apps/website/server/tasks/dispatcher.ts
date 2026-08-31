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

    console.log(
      "[Dispatcher] Starting 1-minute cron cycle (6x 10s iterations)...",
    );

    for (let i = 0; i < 6; i++) {
      // 1. Dispatch heavy 1-minute extraction task only on the very first iteration
      if (i === 0) {
        dispatchTask("wiki_extract");
      }

      // 2. Dispatch fast 10-second tasks on every single iteration
      dispatchTask("wiki_discovery");
      dispatchTask("wiki_check");

      // Pause for 10 seconds between steps
      if (i < 5) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    console.log("[Dispatcher] Finished dispatching all 6 iterations.");
    return { result: "success" };
  },
});
