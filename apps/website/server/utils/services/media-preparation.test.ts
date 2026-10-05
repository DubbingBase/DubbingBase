import { afterEach, describe, expect, it, vi } from "vitest";
import { checkMediaDubbingSections } from "./media-preparation";
import { SimpleCache } from "../cache";
import {
  createMediaResponseError,
  fetchMediaRequest,
  isRetryableMediaRequestError,
} from "../retryable-request";

describe("isRetryableMediaRequestError", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    new DOMException("Request timed out", "TimeoutError"),
    new DOMException("Request aborted", "AbortError"),
    new TypeError("fetch failed"),
  ])("classifies fetch failure as retryable", async (fetchError) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(fetchError));

    let requestError: unknown;
    try {
      await fetchMediaRequest("https://example.test");
    } catch (error) {
      requestError = error;
    }

    expect(isRetryableMediaRequestError(requestError)).toBe(true);
  });

  it("does not retry permanent errors", () => {
    expect(isRetryableMediaRequestError(new Error("No dubbing section"))).toBe(false);
  });

  it.each([408, 425, 429, 500, 503])("retries transient provider status %s", (status) => {
    const response = new Response(null, { status });
    expect(isRetryableMediaRequestError(createMediaResponseError("TMDB", response))).toBe(true);
  });

  it("does not retry permanent provider status", () => {
    const response = new Response(null, { status: 404 });
    expect(isRetryableMediaRequestError(createMediaResponseError("TMDB", response))).toBe(false);
  });
});

describe("checkMediaDubbingSections", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("surfaces a malformed Wikipedia section-list response as an error", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("api.themoviedb.org")
          ? { title: "Example", external_ids: { wikidata_id: "Q42" } }
          : url.includes("wikidata.org/w/api.php")
            ? { entities: { Q42: { sitelinks: { enwiki: { title: "Example" } } } } }
            : url.includes("action=query")
              ? { query: { pages: { "1": { pageid: 1 } } } }
              : { parse: {} };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(
      checkMediaDubbingSections({
        tmdbId: 42,
        type: "movie",
        wikipediaLanguage: "en",
        cache: new SimpleCache(() => null),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("invalid section list"),
        retryable: false,
      }),
    );
  });

  it("surfaces an all-malformed Wikipedia section array as a non-retryable error", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("api.themoviedb.org")
          ? { title: "Example", external_ids: { wikidata_id: "Q42" } }
          : url.includes("wikidata.org/w/api.php")
            ? { entities: { Q42: { sitelinks: { enwiki: { title: "Example" } } } } }
            : url.includes("action=query")
              ? { query: { pages: { "1": { pageid: 1 } } } }
              : { parse: { tocdata: { sections: [{}, { line: "Cast" }] } } };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(
      checkMediaDubbingSections({
        tmdbId: 42,
        type: "movie",
        wikipediaLanguage: "en",
        cache: new SimpleCache(() => null),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("invalid section list"),
        retryable: false,
      }),
    );
  });
});

describe("provider request diagnostics", () => {
  it("logs only a provider and outcome, never request identity or response data", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      await expect(
        observeProviderRequest("tmdb", async () => ({ secret: "private-response" })),
      ).resolves.toEqual({ secret: "private-response" });

      expect(log).toHaveBeenCalledExactlyOnceWith({
        event: "provider_request",
        provider: "tmdb",
        outcome: "response",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-response");
    } finally {
      log.mockRestore();
    }
  });

  it("classifies requests by provider host without logging the URL", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );

    try {
      await fetchMediaRequest("https://api.themoviedb.org/3/movie/private-id?api_key=secret");

      expect(log).toHaveBeenCalledExactlyOnceWith({
        event: "provider_request",
        provider: "tmdb",
        outcome: "response",
      });
      const loggedText = JSON.stringify(log.mock.calls);
      expect(loggedText).not.toContain("private-id");
      expect(loggedText).not.toContain("secret");
    } finally {
      log.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
