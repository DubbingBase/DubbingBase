import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), localFetch: vi.fn() }));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: mocks.rpc }),
}));

import { getReadyMediaQueueNames } from "../media-queue-readiness";

let runDispatcher: typeof import("../../tasks/dispatcher").default.run;

beforeAll(async () => {
  vi.stubGlobal("defineTask", (task: unknown) => task);
  vi.stubGlobal("useRuntimeConfig", () => ({
    supabaseSecretKey: "queue-secret",
  }));
  vi.stubGlobal("useNitroApp", () => ({ localFetch: mocks.localFetch }));
  runDispatcher = (await import("../../tasks/dispatcher")).default.run;
});

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.localFetch.mockReset();
  // A fresh Response per call: a body can only be read once.
  mocks.localFetch.mockImplementation(
    async () => new Response(JSON.stringify({ processed: 1 }), { status: 200 }),
  );
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getReadyMediaQueueNames", () => {
  it("returns only supported ready queues in stable order", () => {
    expect(getReadyMediaQueueNames(["wiki_extract", "unknown", "wiki_scan"])).toEqual([
      "wiki_scan",
      "wiki_extract",
    ]);
  });

  it("treats invalid RPC data as no ready queues", () => {
    expect(getReadyMediaQueueNames(null)).toEqual([]);
    expect(getReadyMediaQueueNames([1, null])).toEqual([]);
  });
});

describe("dispatcher", () => {
  it("returns after one readiness call when all queues are empty", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await runDispatcher({ context: {} });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_ready_media_queues");
    expect(mocks.localFetch).not.toHaveBeenCalled();
  });

  it("starts only queue processors reported ready", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: ["wiki_scan"], error: null })
      .mockResolvedValue({ data: [], error: null });

    await runDispatcher({ context: {} });

    expect(mocks.localFetch).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.localFetch).toHaveBeenCalledWith(
      "/api/process-media-queue",
      expect.objectContaining({ body: { queue: "wiki_scan" } }),
    );
  });

  it("fails open and dispatches every queue if readiness cannot be checked", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await runDispatcher({ context: {} });

    expect(mocks.localFetch).toHaveBeenCalledTimes(2);
    expect(mocks.localFetch.mock.calls.map((call) => call[1].body.queue)).toEqual([
      "wiki_scan",
      "wiki_extract",
    ]);
  });

  it("keeps draining a queue within one tick until it is no longer ready", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: ["wiki_scan"], error: null })
      .mockResolvedValueOnce({ data: ["wiki_scan"], error: null })
      .mockResolvedValueOnce({ data: ["wiki_scan"], error: null })
      .mockResolvedValue({ data: [], error: null });

    await runDispatcher({ context: {} });

    expect(mocks.localFetch).toHaveBeenCalledTimes(3);
  });

  it("stops retrying a queue that reports ready but processes nothing", async () => {
    mocks.rpc.mockResolvedValue({ data: ["wiki_extract"], error: null });
    mocks.localFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ processed: 0, reason: "quota_exhausted" }), { status: 200 }),
    );

    await runDispatcher({ context: {} });

    expect(mocks.localFetch).toHaveBeenCalledTimes(1);
  });
});
