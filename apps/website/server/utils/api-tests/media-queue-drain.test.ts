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

  it("does not start a lane when readiness resolves after the budget", async () => {
    let clock = 0;
    const started: string[] = [];
    await drainMediaQueues({
      getReady: async () => {
        clock = 100;
        return { queues: ["wiki_scan"], failed: false };
      },
      runLane: async (queue) => {
        started.push(queue);
        return { processed: 1, ok: true };
      },
      now: () => clock,
      budgetMs: 50,
      pollMs: 10,
    });
    expect(started).toEqual([]);
  });

  it("re-checks readiness when a lane settled during the readiness call", async () => {
    let calls = 0;
    const started: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await drainMediaQueues({
      getReady: async () => {
        calls++;
        if (calls === 1) return { queues: ["wiki_scan"], failed: false };
        if (calls === 2) {
          // The scan lane finishes (and enqueues extraction) while this check is pending.
          release();
          await sleep(10);
          return { queues: [], failed: false };
        }
        return { queues: calls === 3 ? ["wiki_extract"] : [], failed: false };
      },
      runLane: async (queue) => {
        started.push(queue);
        if (queue === "wiki_scan") await gate;
        return { processed: 1, ok: true };
      },
      now: () => performance.now(),
      budgetMs: 5_000,
      pollMs: 1_000,
    });
    expect(started).toEqual(["wiki_scan", "wiki_extract"]);
  });
});
