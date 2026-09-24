import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(isRetryableMediaRequestError(new Error("No dubbing section"))).toBe(
      false,
    );
  });

  it.each([408, 425, 429, 500, 503])(
    "retries transient provider status %s",
    (status) => {
      const response = new Response(null, { status });
      expect(
        isRetryableMediaRequestError(
          createMediaResponseError("TMDB", response),
        ),
      ).toBe(true);
    },
  );

  it("does not retry permanent provider status", () => {
    const response = new Response(null, { status: 404 });
    expect(
      isRetryableMediaRequestError(createMediaResponseError("TMDB", response)),
    ).toBe(false);
  });
});
