import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { TVDBClient } from "./tvdb";

const TOKEN_KEY = "tvdb:auth_token";
const TOKEN_TTL = 23 * 60 * 60;

type FetchHandler = (url: URL, init?: RequestInit) => Promise<Response> | Response;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeHarness(options: {
  values?: Map<string, unknown>;
  readError?: boolean;
  writeError?: boolean;
  beforeWrite?: (value: unknown) => Promise<void>;
  fetch: FetchHandler;
}) {
  const values = options.values ?? new Map<string, unknown>();
  const reads: string[] = [];
  const writes: Array<{ key: string; value: unknown; ttl: number }> = [];
  const deletes: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    options.fetch(new URL(String(input)), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("useRuntimeConfig", () => ({ tvdbApiKey: "test-key" }));

  const cache = new SimpleCache(() => ({
    get: async (key) => {
      reads.push(key);
      if (options.readError) throw new Error("KV read failed");
      return values.get(key) ?? null;
    },
    put: async (key, value, config) => {
      const parsed: unknown = JSON.parse(value);
      writes.push({ key, value: parsed, ttl: config.expirationTtl });
      await options.beforeWrite?.(parsed);
      if (options.writeError) throw new Error("KV write failed");
      values.set(key, parsed);
    },
    delete: async (key) => {
      deletes.push(key);
      values.delete(key);
    },
  }));

  return {
    client: new TVDBClient(cache),
    values,
    reads,
    writes,
    deletes,
    fetchMock,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TVDB authentication", () => {
  it("uses a valid cached token without logging in", async () => {
    const harness = makeHarness({
      values: new Map([[TOKEN_KEY, "valid-token"]]),
      fetch: () => response({ data: { id: 42 } }),
    });

    await harness.client.getSeriesById(42);

    expect(harness.reads).toEqual([TOKEN_KEY]);
    expect(harness.writes).toEqual([]);
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = harness.fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api4.thetvdb.com/v4/series/42");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer valid-token");
  });

  it("logs in on a cache miss and persists a token after an authenticated response", async () => {
    const harness = makeHarness({
      fetch: (url) =>
        url.pathname.endsWith("/login")
          ? response({ data: { token: "fresh-token" } })
          : response({ data: { id: 42 } }),
    });

    await harness.client.getSeriesById(42);

    expect(harness.reads).toEqual([TOKEN_KEY]);
    expect(harness.writes).toEqual([{ key: TOKEN_KEY, value: "fresh-token", ttl: TOKEN_TTL }]);
    expect(harness.fetchMock).toHaveBeenCalledTimes(2);
    expect(String(harness.fetchMock.mock.calls[0]![0])).toBe("https://api4.thetvdb.com/v4/login");
    expect(harness.values.get(TOKEN_KEY)).toBe("fresh-token");
  });

  it("refreshes a rejected token and retries the authenticated request once", async () => {
    const harness = makeHarness({
      values: new Map([[TOKEN_KEY, "stale-token"]]),
      fetch: (url, init) => {
        if (url.pathname.endsWith("/login")) return response({ data: { token: "fresh-token" } });
        if (new Headers(init?.headers).get("Authorization") === "Bearer stale-token") {
          return response({}, 401);
        }
        return response({ data: { id: 42 } });
      },
    });

    await harness.client.getSeriesById(42);

    expect(harness.fetchMock).toHaveBeenCalledTimes(3);
    expect(String(harness.fetchMock.mock.calls[1]![0])).toBe("https://api4.thetvdb.com/v4/login");
    expect(new Headers(harness.fetchMock.mock.calls[2]![1]?.headers).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    expect(harness.writes).toEqual([{ key: TOKEN_KEY, value: "fresh-token", ttl: TOKEN_TTL }]);
    expect(harness.deletes).toEqual([]);
  });

  it("does not loop or persist a refreshed token after a second 401", async () => {
    const harness = makeHarness({
      values: new Map([[TOKEN_KEY, "stale-token"]]),
      fetch: (url) =>
        url.pathname.endsWith("/login")
          ? response({ data: { token: "rejected-refresh" } })
          : response({}, 401),
    });

    await expect(harness.client.getSeriesById(42)).rejects.toThrow("TVDB API error: 401");

    expect(harness.fetchMock).toHaveBeenCalledTimes(3);
    expect(harness.writes).toEqual([]);
    expect(harness.values.get(TOKEN_KEY)).toBe("stale-token");
    expect(harness.deletes).toEqual([]);
  });

  it("does not retry a rejected login or cache its error", async () => {
    const harness = makeHarness({
      fetch: () => response({ message: "rejected" }, 401),
    });

    await expect(harness.client.getSeriesById(42)).rejects.toThrow("TVDB auth failed: 401");

    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.writes).toEqual([]);
    expect(harness.values.has(TOKEN_KEY)).toBe(false);
  });

  it("does not cache an empty token from a malformed successful login response", async () => {
    const harness = makeHarness({
      fetch: () => response({ data: { token: "" } }),
    });

    await expect(harness.client.getSeriesById(42)).rejects.toThrow(
      "TVDB auth response did not contain a token",
    );

    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.writes).toEqual([]);
    expect(harness.values.has(TOKEN_KEY)).toBe(false);
  });

  it("continues with a successful login when a KV read fails", async () => {
    const harness = makeHarness({
      readError: true,
      fetch: (url) =>
        url.pathname.endsWith("/login")
          ? response({ data: { token: "fresh-token" } })
          : response({ data: { id: 42 } }),
    });

    await expect(harness.client.getSeriesById(42)).resolves.toEqual({
      data: { id: 42 },
    });

    expect(harness.reads).toEqual([TOKEN_KEY]);
    expect(harness.fetchMock).toHaveBeenCalledTimes(2);
    expect(harness.writes).toHaveLength(1);
  });

  it("continues when a KV write fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const harness = makeHarness({
      writeError: true,
      fetch: (url) =>
        url.pathname.endsWith("/login")
          ? response({ data: { token: "fresh-token" } })
          : response({ data: { id: 42 } }),
    });

    await expect(harness.client.getSeriesById(42)).resolves.toEqual({
      data: { id: 42 },
    });

    expect(harness.writes).toHaveLength(1);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it("persists a refreshed token after an older token write finishes", async () => {
    let releaseOldTokenWrite: (() => void) | undefined;
    const harness = makeHarness({
      beforeWrite: (value) =>
        value === "old-token"
          ? new Promise<void>((resolve) => {
              releaseOldTokenWrite = resolve;
            })
          : Promise.resolve(),
      fetch: (url, init) => {
        if (url.pathname.endsWith("/login")) {
          const loginCount = harness.fetchMock.mock.calls.filter(([input]) =>
            String(input).endsWith("/login"),
          ).length;
          return response({
            data: { token: loginCount === 1 ? "old-token" : "new-token" },
          });
        }
        const authorization = new Headers(init?.headers).get("Authorization");
        if (url.pathname.endsWith("/series/2") && authorization === "Bearer old-token") {
          return response({}, 401);
        }
        return response({ data: { id: url.pathname.split("/").pop() } });
      },
    });

    const olderRequest = harness.client.getSeriesById(1);
    await vi.waitFor(() => expect(harness.writes.map(({ value }) => value)).toContain("old-token"));
    const refreshedRequest = harness.client.getSeriesById(2);

    await vi.waitFor(() =>
      expect(
        harness.fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/login")),
      ).toHaveLength(2),
    );
    releaseOldTokenWrite?.();

    await expect(Promise.all([olderRequest, refreshedRequest])).resolves.toEqual([
      { data: { id: "1" } },
      { data: { id: "2" } },
    ]);
    expect(harness.values.get(TOKEN_KEY)).toBe("new-token");
    expect(harness.writes.map(({ value }) => value)).toEqual(["old-token", "new-token"]);
  });

  it("coalesces concurrent cache-miss authentication within the isolate", async () => {
    let resolveLogin: ((value: Response) => void) | undefined;
    const harness = makeHarness({
      fetch: (url) => {
        if (url.pathname.endsWith("/login")) {
          return new Promise<Response>((resolve) => {
            resolveLogin = resolve;
          });
        }
        return response({
          data: { id: Number(url.pathname.split("/").pop()) },
        });
      },
    });

    const first = harness.client.getSeriesById(41);
    const second = harness.client.getSeriesById(42);
    await vi.waitFor(() => expect(harness.fetchMock).toHaveBeenCalledTimes(1));
    resolveLogin?.(response({ data: { token: "shared-token" } }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { data: { id: 41 } },
      { data: { id: 42 } },
    ]);
    expect(harness.fetchMock).toHaveBeenCalledTimes(3);
    expect(harness.writes).toHaveLength(1);
  });

  it("coalesces concurrent stale-token refreshes within the isolate", async () => {
    const harness = makeHarness({
      values: new Map([[TOKEN_KEY, "stale-token"]]),
      fetch: (url, init) => {
        if (url.pathname.endsWith("/login")) return response({ data: { token: "fresh-token" } });
        if (new Headers(init?.headers).get("Authorization") === "Bearer stale-token") {
          return response({}, 401);
        }
        return response({ data: { id: 42 } });
      },
    });

    await expect(
      Promise.all([harness.client.getSeriesById(41), harness.client.getSeriesById(42)]),
    ).resolves.toEqual([{ data: { id: 42 } }, { data: { id: 42 } }]);

    expect(harness.fetchMock).toHaveBeenCalledTimes(5);
    expect(harness.writes).toHaveLength(1);
    expect(harness.values.get(TOKEN_KEY)).toBe("fresh-token");
    expect(harness.deletes).toEqual([]);
  });

  it("keeps a newer token when a delayed request rejects an older one", async () => {
    let rejectOldRequest: ((value: Response) => void) | undefined;
    const harness = makeHarness({
      values: new Map([[TOKEN_KEY, "old-token"]]),
      fetch: (url, init) => {
        if (url.pathname.endsWith("/login")) return response({ data: { token: "new-token" } });
        if (url.pathname.endsWith("/series/41")) {
          if (new Headers(init?.headers).get("Authorization") === "Bearer old-token") {
            return new Promise<Response>((resolve) => {
              rejectOldRequest = resolve;
            });
          }
          return response({ data: { id: 41 } });
        }
        if (new Headers(init?.headers).get("Authorization") === "Bearer old-token") {
          return response({}, 401);
        }
        return response({ data: { id: 42 } });
      },
    });

    const delayed = harness.client.getSeriesById(41);
    await vi.waitFor(() => expect(harness.fetchMock).toHaveBeenCalledTimes(1));
    await harness.client.getSeriesById(42);
    rejectOldRequest?.(response({}, 401));
    await delayed;

    expect(harness.values.get(TOKEN_KEY)).toBe("new-token");
    expect(harness.deletes).toEqual([]);
    expect(harness.fetchMock).toHaveBeenCalledTimes(5);
  });
});
