import type { H3Event } from "h3";

type BackgroundTask = () => Promise<void>;

/**
 * Run non-critical work without extending the response time of a request.
 * Cloudflare keeps the promise alive with waitUntil; local Node requests
 * still start the task but do not wait for it.
 */
export function scheduleBackgroundTask(event: H3Event, task: BackgroundTask, label: string): void {
  const promise = task().catch((error: unknown) => {
    console.error(`[Background:${label}]`, error);
  });

  const cloudflare = event.context.cloudflare;
  const executionContext = cloudflare?.ctx ?? cloudflare?.context;

  if (executionContext && typeof executionContext.waitUntil === "function") {
    executionContext.waitUntil(promise);
    return;
  }

  void promise;
}
