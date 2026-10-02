import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMediaResponseError,
  fetchMediaRequest,
  isRetryableMediaRequestError,
  observeProviderRequest,
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
