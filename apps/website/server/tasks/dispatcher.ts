import { useSupabaseAdmin } from "../utils/db/client";
import { drainMediaQueues, type QueueLaneResult } from "../utils/media-queue-drain";
import { internalRequestHeaders, resolveInternalSecret } from "../utils/internal-secret";
import {
  getReadyMediaQueueNames,
  mediaQueueNames,
  type MediaQueueName,
} from "../utils/media-queue-readiness";
import { readProperty } from "@app/shared-logic";

// Stop starting new batches after this long so the next cron tick takes over cleanly.
const DRAIN_BUDGET_MS = 40_000;
// While a lane runs (LLM calls can take a while), re-check for newly ready work this often.
const READINESS_POLL_MS = 3_000;

export default defineTask({
  meta: {
    name: "dispatcher",
    description: "Cron dispatcher that drains ready media queues within the tick",
  },
  async run(event) {
    const cf = readProperty(event?.context, "cloudflare");
    const config = useRuntimeConfig();
    const nitroApp = useNitroApp();
    const headers = internalRequestHeaders(
      resolveInternalSecret(config.supabaseSecretKey, readProperty(cf, "env")),
    );
    const startedAt = performance.now();

    const getReady = async (): Promise<{ queues: MediaQueueName[]; failed: boolean }> => {
      try {
        const { data, error } = await useSupabaseAdmin(event).rpc("get_ready_media_queues");
        if (error || !Array.isArray(data)) {
          throw error ?? new Error("Queue readiness RPC returned an invalid result");
        }
        return { queues: getReadyMediaQueueNames(data), failed: false };
      } catch (error) {
        console.error(
          "[Dispatcher] Queue readiness check failed; dispatching all queues to preserve processing.",
          error,
        );
        return { queues: [...mediaQueueNames], failed: true };
      }
    };

    const runLane = async (queueName: MediaQueueName): Promise<QueueLaneResult> => {
      const laneStartedAt = performance.now();
      try {
        const res = await nitroApp.localFetch("/api/process-media-queue", {
          method: "POST",
          headers,
          body: { queue: queueName },
          context: event?.context,
        });
        const durationMs = Math.round(performance.now() - laneStartedAt);
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[Dispatcher] Queue ${queueName} returned status ${res.status}: ${errText}`);
          return { processed: 0, ok: false };
        }
        const responseBody: unknown = await res.json().catch(() => undefined);
        const processed = readProperty(responseBody, "processed");
        const processedCount = typeof processed === "number" ? processed : 0;
        console.log(
          `[Dispatcher] Queue ${queueName} processed=${processedCount} duration_ms=${durationMs}.`,
        );
        // A 200 can still carry `ok: false` (e.g. extraction failed); park the queue then.
        return { processed: processedCount, ok: readProperty(responseBody, "ok") !== false };
      } catch (err) {
        console.error(`[Dispatcher] Error processing queue ${queueName}:`, err);
        return { processed: 0, ok: false };
      }
    };

    const summary = await drainMediaQueues({
      getReady,
      runLane,
      now: () => performance.now(),
      budgetMs: DRAIN_BUDGET_MS,
      pollMs: READINESS_POLL_MS,
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const message = `lanes=${summary.lanesStarted} processed=${summary.processed} readiness_checks=${summary.readinessChecks} duration_ms=${durationMs}`;
    if (summary.lanesStarted === 0) {
      console.debug(`[Dispatcher] Empty queue tick ${message}.`);
    } else {
      console.info(`[Dispatcher] Queue tick ${message}.`);
    }

    return { result: "success", ...summary };
  },
});
