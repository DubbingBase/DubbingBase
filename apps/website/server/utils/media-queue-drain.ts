import type { MediaQueueName } from "./media-queue-readiness";

export interface QueueLaneResult {
  /** Messages the lane handled. Zero means nothing was actually poppable. */
  processed: number;
  ok: boolean;
}

export interface DrainDependencies {
  /** Returns ready queues; `failed` means readiness could not be checked. */
  getReady(): Promise<{ queues: MediaQueueName[]; failed: boolean }>;
  /** Pops and processes one batch from a queue. */
  runLane(queue: MediaQueueName): Promise<QueueLaneResult>;
  now(): number;
  /** No new lane starts after this many ms. In-flight lanes are always awaited. */
  budgetMs: number;
  /** How often to re-check readiness while a lane is still running. */
  pollMs: number;
}

export interface DrainSummary {
  lanesStarted: number;
  processed: number;
  readinessChecks: number;
}

/**
 * Keeps processing ready queues within one cron tick instead of one batch per minute.
 *
 * Each queue runs at most one lane at a time, and lanes of different queues overlap, so the
 * work a scan lane enqueues for extraction is picked up as soon as it is ready. A queue is
 * dropped for the rest of the tick once a lane fails or pops nothing, which prevents hot
 * loops (for example an exhausted LLM quota that reports "ready" but processes zero items).
 * Pops are atomic and use visibility timeouts, so an overlapping tick cannot double-process.
 */
export async function drainMediaQueues(deps: DrainDependencies): Promise<DrainSummary> {
  const startedAt = deps.now();
  const inFlight = new Map<MediaQueueName, Promise<void>>();
  const parked = new Set<MediaQueueName>();
  const summary: DrainSummary = { lanesStarted: 0, processed: 0, readinessChecks: 0 };

  const startLane = (queue: MediaQueueName) => {
    summary.lanesStarted++;
    const lane = deps
      .runLane(queue)
      .then((result) => {
        summary.processed += result.processed;
        if (!result.ok || result.processed === 0) parked.add(queue);
      })
      .catch(() => {
        parked.add(queue);
      })
      .finally(() => {
        inFlight.delete(queue);
      });
    inFlight.set(queue, lane);
  };

  while (true) {
    if (deps.now() - startedAt >= deps.budgetMs) break;

    summary.readinessChecks++;
    const ready = await deps.getReady();
    for (const queue of ready.queues) {
      if (!inFlight.has(queue) && !parked.has(queue)) startLane(queue);
    }

    // Without a trustworthy readiness signal, run each queue once and stop.
    if (ready.failed) break;
    if (inFlight.size === 0) break;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, deps.pollMs);
    });
    await Promise.race([...inFlight.values(), tick]);
    clearTimeout(timer);
  }

  await Promise.all(inFlight.values());
  return summary;
}
