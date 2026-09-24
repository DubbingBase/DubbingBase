function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function getStringProperty(value: unknown, key: string): string | undefined {
  const property = readProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

function hasWaitUntil(value: unknown): value is WaitUntilContext {
  return typeof readProperty(value, "waitUntil") === "function";
}

export default defineTask({
  meta: {
    name: "dispatcher",
    description: "Cron dispatcher that processes each media queue once per minute",
  },
  async run(event) {
    const cf = readProperty(event?.context, "cloudflare");
    const cfCtx = readProperty(cf, "ctx") ?? readProperty(cf, "context");
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();

    const secretKey =
      config.supabaseSecretKey ||
      getStringProperty(readProperty(cf, "env"), "SUPABASE_SECRET_KEY") ||
      getStringProperty(readProperty(cf, "env"), "NUXT_SUPABASE_SECRET_KEY") ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(secretKey ? { "x-internal-secret": secretKey } : {}),
    };

    const dispatchTask = (queueName: "wiki_discovery" | "wiki_check" | "wiki_extract") => {
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
            console.log(`[Dispatcher] Queue ${queueName} completed successfully.`);
          }
        })
        .catch((err) => {
          console.error(`[Dispatcher] Error processing queue ${queueName}:`, err);
        });

      if (hasWaitUntil(cfCtx)) {
        cfCtx.waitUntil(taskPromise);
      } else if (hasWaitUntil(event)) {
        event.waitUntil(taskPromise);
      }
    };

    // One cron invocation starts each queue processor once. Discovery and check
    // each claim a bounded batch of three items; extraction stays at one item per
    // minute to limit LLM usage. Queue endpoints handle processing and retries.
    console.log("[Dispatcher] Starting one-minute queue cycle...");
    dispatchTask("wiki_discovery");
    dispatchTask("wiki_check");
    dispatchTask("wiki_extract");

    console.log("[Dispatcher] Dispatched all three queues.");
    return { result: "success" };
  },
});
