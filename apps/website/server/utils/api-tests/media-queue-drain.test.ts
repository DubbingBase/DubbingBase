import { describe, expect, it } from "vitest";
import { drainMediaQueues } from "../media-queue-drain";
import type { MediaQueueName } from "../media-queue-readiness";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("drainMediaQueues", () => {
  it("picks up extract work enqueued by a scan lane while scan is still draining", async () => {
    let scanLeft = 3;
    let extractLeft = 0;
    const order: string[] = [];

    const summary = await drainMediaQueues({
      getReady: async () => ({
        queues: [
          ...(scanLeft > 0 ? (["wiki_scan"] as const) : []),
          ...(extractLeft > 0 ? (["wiki_extract"] as const) : []),
        ],
        failed: false,
      }),
      runLane: async (queue: MediaQueueName) => {
        await sleep(5);
        order.push(queue);
        if (queue === "wiki_scan") {
          scanLeft--;
          extractLeft++;
        } else {
          extractLeft--;
        }
        return { processed: 1, ok: true };
      },
      now: () => performance.now(),
      budgetMs: 5_000,
      pollMs: 10,
    });

    expect(scanLeft).toBe(0);
    expect(extractLeft).toBe(0);
    expect(summary.processed).toBe(6);
    // Extract started before scan finished its last batch.
    expect(order.indexOf("wiki_extract")).toBeLessThan(order.lastIndexOf("wiki_scan"));
  });

  it("never runs two lanes of the same queue at once", async () => {
    let active = 0;
    let maxActive = 0;
    let left = 4;
    await drainMediaQueues({
      getReady: async () => ({ queues: left > 0 ? ["wiki_scan"] : [], failed: false }),
      runLane: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(5);
        active--;
        left--;
        return { processed: 1, ok: true };
      },
      now: () => performance.now(),
      budgetMs: 5_000,
      pollMs: 1,
    });
    expect(maxActive).toBe(1);
  });

  it("parks a queue after a failed lane and stops starting new ones past the budget", async () => {
    let runs = 0;
    await drainMediaQueues({
      getReady: async () => ({ queues: ["wiki_scan"], failed: false }),
      runLane: async () => {
        runs++;
        return { processed: 0, ok: false };
      },
      now: () => performance.now(),
      budgetMs: 5_000,
      pollMs: 1,
    });
    expect(runs).toBe(1);

    let clock = 0;
    let budgetRuns = 0;
    await drainMediaQueues({
      getReady: async () => ({ queues: ["wiki_scan"], failed: false }),
      runLane: async () => {
        budgetRuns++;
        clock += 20_000;
        return { processed: 1, ok: true };
      },
      now: () => clock,
      budgetMs: 10_000,
      pollMs: 1,
    });
    expect(budgetRuns).toBe(1);
  });
});
