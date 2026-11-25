import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("./client", () => ({
  useSupabaseAdmin: () => ({ rpc: mocks.rpc }),
}));

// No KV binding in tests: SimpleCache then simply runs the fetcher.
const cache = new SimpleCache(() => null);
vi.mock("../index", () => ({
  useCache: () => cache,
}));

import { invalidateKnownContentIds, isKnownActor, isKnownMedia } from "./known-content-ids";

const SNAPSHOT = {
  media: { movie: [550, 603], tv: [550], video_game: [1020] },
  actors: [10, 20],
};

describe("known content ids", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: SNAPSHOT, error: null });
    await invalidateKnownContentIds();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recognises ids that have data and rejects the others", async () => {
    expect(await isKnownMedia("movie", 550)).toBe(true);
    expect(await isKnownMedia("movie", 999_999)).toBe(false);
    expect(await isKnownActor(10)).toBe(true);
    expect(await isKnownActor(1_396_774)).toBe(false);
  });

  it("keeps kinds apart: a TV id is not a movie id", async () => {
    expect(await isKnownMedia("tv", 603)).toBe(false);
    expect(await isKnownMedia("movie", 603)).toBe(true);
  });

  it("reports a kind with no rows as unknown rather than failing open", async () => {
    expect(await isKnownMedia("toy", 1)).toBe(false);
  });

  it("builds the snapshot with one RPC call for any number of lookups", async () => {
    await Promise.all([
      isKnownMedia("movie", 1),
      isKnownMedia("tv", 2),
      isKnownActor(3),
      isKnownActor(4),
    ]);
    await isKnownMedia("movie", 5);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_known_content_ids");
  });

  it("rebuilds the snapshot once the isolate copy expires", async () => {
    await isKnownMedia("movie", 550);
    vi.advanceTimersByTime(29_000);
    await isKnownMedia("movie", 550);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await isKnownMedia("movie", 550);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("sees a newly added id after the snapshot is invalidated", async () => {
    expect(await isKnownMedia("movie", 777)).toBe(false);

    mocks.rpc.mockResolvedValue({
      data: { ...SNAPSHOT, media: { ...SNAPSHOT.media, movie: [550, 603, 777] } },
      error: null,
    });
    // Still the old copy until something invalidates it.
    expect(await isKnownMedia("movie", 777)).toBe(false);

    await invalidateKnownContentIds();
    expect(await isKnownMedia("movie", 777)).toBe(true);
  });

  it("never throws when the shared cache cannot be cleared, because the write already committed", async () => {
    vi.spyOn(cache, "del").mockRejectedValue(new Error("KV unavailable"));

    await expect(invalidateKnownContentIds()).resolves.toBeUndefined();
  });

  describe("invalidation while a load is in flight", () => {
    /** An RPC that stays pending until the test releases it, to model a slow snapshot build. */
    function deferredRpc(data: unknown) {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.rpc.mockImplementationOnce(async () => {
        await gate;
        return { data, error: null };
      });
      return release;
    }

    it("does not keep a snapshot that started before the write", async () => {
      const release = deferredRpc(SNAPSHOT);
      const stale = isKnownMedia("movie", 777);

      await invalidateKnownContentIds();
      release();

      // The pre-write load must not decide: its caller falls back to the database.
      expect(await stale).toBe(true);
      // And it must not have been cached: the next lookup rebuilds from the database.
      mocks.rpc.mockResolvedValue({
        data: { ...SNAPSHOT, media: { ...SNAPSHOT.media, movie: [550, 603, 777] } },
        error: null,
      });
      expect(await isKnownMedia("movie", 777)).toBe(true);
      expect(await isKnownMedia("movie", 888)).toBe(false);
    });

    it("starts a fresh load after the write instead of joining the pre-write one", async () => {
      const release = deferredRpc(SNAPSHOT);
      const stale = isKnownMedia("movie", 777);

      await invalidateKnownContentIds();
      mocks.rpc.mockResolvedValue({
        data: { ...SNAPSHOT, media: { ...SNAPSHOT.media, movie: [550, 603, 777] } },
        error: null,
      });
      const fresh = isKnownMedia("movie", 777);
      release();

      await stale;
      expect(await fresh).toBe(true);
      expect(mocks.rpc).toHaveBeenCalledTimes(2);
    });

    it("removes the pre-write snapshot from the shared cache", async () => {
      const del = vi.spyOn(cache, "del");
      const release = deferredRpc(SNAPSHOT);
      const stale = isKnownMedia("movie", 777);

      await invalidateKnownContentIds();
      del.mockClear();
      release();
      await stale;

      expect(del).toHaveBeenCalledTimes(1);
    });
  });

  describe("fails open, so a broken cache can never hide real data", () => {
    it("when the RPC errors", async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

      expect(await isKnownMedia("movie", 999_999)).toBe(true);
      expect(await isKnownActor(999_999)).toBe(true);
    });

    it("when the RPC throws", async () => {
      mocks.rpc.mockRejectedValue(new Error("network down"));

      expect(await isKnownActor(999_999)).toBe(true);
    });

    it("when the snapshot is malformed", async () => {
      mocks.rpc.mockResolvedValue({ data: { media: "nope", actors: [1] }, error: null });

      expect(await isKnownMedia("movie", 999_999)).toBe(true);
    });

    it("when a single id is not an integer, instead of trusting a partial set", async () => {
      mocks.rpc.mockResolvedValue({
        data: { media: { movie: [550, "603"] }, actors: [10] },
        error: null,
      });

      expect(await isKnownMedia("movie", 999_999)).toBe(true);
      expect(await isKnownActor(999_999)).toBe(true);
    });

    it("when the snapshot is completely empty", async () => {
      mocks.rpc.mockResolvedValue({ data: { media: {}, actors: [] }, error: null });

      expect(await isKnownMedia("movie", 999_999)).toBe(true);
    });

    it("and retries after a short delay instead of on every request", async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });
      await isKnownMedia("movie", 1);
      await isKnownMedia("movie", 2);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);

      mocks.rpc.mockResolvedValue({ data: SNAPSHOT, error: null });
      vi.advanceTimersByTime(16_000);
      expect(await isKnownMedia("movie", 999_999)).toBe(false);
      expect(mocks.rpc).toHaveBeenCalledTimes(2);
    });
  });
});
