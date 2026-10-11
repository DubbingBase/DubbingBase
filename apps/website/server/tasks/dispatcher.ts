import { useSupabaseAdmin } from "../utils/db/client";
import {
  getReadyMediaQueueNames,
  mediaQueueNames,
  type MediaQueueName,
} from "../utils/media-queue-readiness";

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
    description: "Cron dispatcher that starts only ready media queues",
  },
  async run(event) {
    const cycleStartedAt = performance.now();
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

    const dispatchTask = (queueName: MediaQueueName) => {
      const queueStartedAt = performance.now();
      const taskPromise = nitroApp
        .localFetch("/api/process-media-queue", {
          method: "POST",
          headers,
          body: { queue: queueName },
          context: event?.context,
        })
        .then(async (res) => {
          const durationMs = Math.round(performance.now() - queueStartedAt);
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.warn(
              `[Dispatcher] Queue ${queueName} returned status ${res.status}: ${errText}`,
            );
          } else {
            let responseBody: unknown;
            try {
              responseBody = await res.json();
            } catch {
              responseBody = undefined;
            }
            const processed = readProperty(responseBody, "processed");
            const processedCount = typeof processed === "number" ? processed : 0;
            console.log(
              `[Dispatcher] Queue ${queueName} processed=${processedCount} duration_ms=${durationMs}.`,
            );
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

    let readyQueueNames: MediaQueueName[];
    let readinessFailed = false;
    try {
      const { data, error } = await useSupabaseAdmin(event).rpc("get_ready_media_queues");
      if (error || !Array.isArray(data)) {
        throw error ?? new Error("Queue readiness RPC returned an invalid result");
      }
      readyQueueNames = getReadyMediaQueueNames(data);
    } catch (error) {
      readinessFailed = true;
      readyQueueNames = [...mediaQueueNames];
      console.error(
        "[Dispatcher] Queue readiness check failed; dispatching all queues to preserve processing.",
        error,
      );
    }

    const readinessDurationMs = Math.round(performance.now() - cycleStartedAt);
    if (readyQueueNames.length === 0) {
      console.info(
        `[Dispatcher] Empty queue tick queues_checked=${mediaQueueNames.length} queues_ready=0 db_calls=1 duration_ms=${readinessDurationMs}.`,
      );
      return { result: "success", processed: 0 };
    }

    console.info(
      `[Dispatcher] Queue tick queues_ready=${readyQueueNames.join(",")} db_calls=1 readiness_failed=${readinessFailed} duration_ms=${readinessDurationMs}.`,
    );
    for (const queueName of readyQueueNames) dispatchTask(queueName);

    return { result: "success", queuesDispatched: readyQueueNames.length };
  },
});
