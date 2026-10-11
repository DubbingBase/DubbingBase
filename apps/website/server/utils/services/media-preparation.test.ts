import { afterEach, describe, expect, it, vi } from "vitest";
import { checkMediaDubbingSections, extractMediaDubbingCredits } from "./media-preparation";
import { SimpleCache } from "../cache";
import type { ExtractedCredit } from "./voice-actor";
import { buildWikipediaExtractionBatches } from "./wiki-extraction-batching";
import {
  createMediaResponseError,
  fetchMediaRequest,
  isRetryableMediaRequestError,
} from "../retryable-request";

const extractionMocks = vi.hoisted(() => ({
  llmGenerateObject: vi.fn<
    (
      prompt: string,
      schema: unknown,
      options?: unknown,
    ) => Promise<{
      data: { items: Array<Record<string, unknown>> };
      model: string;
      quota?: string;
    }>
  >(),
  applyExtractedCredits:
    vi.fn<
      (
        contentId: number,
        contentType: "movie" | "tv" | "video_game",
        language: string,
        credits: ExtractedCredit[],
      ) => Promise<{ newVoiceActors: number; creditsAdded: number }>
    >(),
}));

vi.mock("../llm", () => ({
  llmGenerateObject: extractionMocks.llmGenerateObject,
}));
vi.mock("./voice-actor", () => ({
  applyExtractedCredits: extractionMocks.applyExtractedCredits,
}));

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

  it("does not fetch Wikidata sitelinks when scan metadata is already resolved", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("action=query")
        ? { query: { pages: { "55": { pageid: 55 } } } }
        : { parse: { revid: 123, tocdata: { sections: [{ index: 2, line: "Cast" }] } } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkMediaDubbingSections({
      tmdbId: 42,
      type: "movie",
      wikipediaLanguage: "en",
      resolvedMetadata: {
        title: "Example",
        wikiId: "Q42",
        pageTitle: "Example",
      },
      cache: new SimpleCache(() => null),
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, revisionId: 123 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requestedUrls.some((url) => url.includes("wikidata.org"))).toBe(false);
  });

  it("surfaces a malformed Wikipedia section-list response as an error", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("api.themoviedb.org")
          ? { title: "Example", external_ids: { wikidata_id: "Q42" } }
          : url.includes("wikidata.org/w/api.php")
            ? {
                entities: {
                  Q42: { sitelinks: { enwiki: { title: "Example" } } },
                },
              }
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
            ? {
                entities: {
                  Q42: { sitelinks: { enwiki: { title: "Example" } } },
                },
              }
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

describe("batched media credit extraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function setupExtractionFetch(options?: {
    stalePinnedRevision?: boolean;
    changedHeading?: boolean;
    partialFailure?: boolean;
  }) {
    const requestedUrls: string[] = [];
    let activeSectionRequests = 0;
    let maxConcurrentSectionRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("api.themoviedb.org")) {
        return new Response(JSON.stringify({ cast: [{ id: 700, name: "Target Actor" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("action=parse") && url.includes("prop=tocdata")) {
        return new Response(
          JSON.stringify({
            parse: {
              revid: 901,
              tocdata: {
                sections: [
                  {
                    index: 2,
                    line: options?.changedHeading ? "Changed cast" : "Dubbing cast",
                  },
                  { index: 4, line: "Voice cast" },
                ],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (options?.partialFailure && url.includes("section=4")) {
        return new Response("temporary outage", { status: 503 });
      }
      if (url.includes("prop=wikitext")) {
        activeSectionRequests += 1;
        maxConcurrentSectionRequests = Math.max(
          maxConcurrentSectionRequests,
          activeSectionRequests,
        );
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeSectionRequests -= 1;
      }
      const revision = options?.stalePinnedRevision
        ? url.includes("oldid=900")
          ? 901
          : url.includes("oldid=901")
            ? 901
            : 900
        : 900;
      return new Response(
        JSON.stringify({
          parse: {
            revid: revision,
            wikitext: `section body ${url.includes("section=2") ? "two" : "four"}`,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    extractionMocks.llmGenerateObject.mockResolvedValue({
      data: {
        items: [
          {
            actor: "Target Actor",
            voiceActorFirstname: "Alex",
            voiceActorName: "Dubber",
            performance: "Role One",
          },
          {
            actor: "Target Actor",
            voiceActorFirstname: "Alex",
            voiceActorName: "Dubber",
            performance: "Role One",
          },
        ],
      },
      model: "fixture-model",
      quota: "fixture-quota",
    });
    extractionMocks.applyExtractedCredits.mockResolvedValue({
      newVoiceActors: 1,
      creditsAdded: 1,
    });
    return {
      requestedUrls,
      fetchMock,
      get maxConcurrentSectionRequests() {
        return maxConcurrentSectionRequests;
      },
    };
  }

  const standardMetadata = {
    title: "Fixture Film",
    wikiId: "Q123",
    pageTitle: "Fixture Film",
    revisionId: 900,
    sectionHeadings: ["Dubbing cast", "Voice cast"],
  };

  it("fetches validated sections concurrently and uses one regional LLM call", async () => {
    const extractionFetch = setupExtractionFetch();
    const { requestedUrls } = extractionFetch;
    const result = await extractMediaDubbingCredits({
      tmdbId: 42,
      type: "movie",
      wikipediaLanguage: "fr",
      dubbingLanguage: "fr-FR",
      pageId: 123,
      sectionIndexes: [2, 4],
      scanMetadata: standardMetadata,
      cache: new SimpleCache(() => null),
    });

    expect(result).toMatchObject({
      ok: true,
      title: "Fixture Film",
      llmModel: "fixture-model",
    });
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledTimes(1);
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledWith(
      expect.stringContaining("WIKIPEDIA SECTION #2: Dubbing cast"),
      expect.anything(),
      expect.anything(),
    );
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledWith(
      expect.stringContaining("WIKIPEDIA SECTION #4: Voice cast"),
      expect.anything(),
      expect.anything(),
    );
    expect(requestedUrls.filter((url) => url.includes("prop=wikitext"))).toHaveLength(2);
    expect(requestedUrls.some((url) => url.includes("prop=tocdata"))).toBe(false);
    expect(extractionFetch.maxConcurrentSectionRequests).toBe(2);
    expect(extractionMocks.applyExtractedCredits).toHaveBeenCalledWith(42, "movie", "fr-FR", [
      expect.objectContaining({ actorId: 700, performance: "Role One" }),
    ]);
  });

  it("refreshes the TOC only when the pinned revision cannot be fetched", async () => {
    const { requestedUrls } = setupExtractionFetch({
      stalePinnedRevision: true,
    });
    const result = await extractMediaDubbingCredits({
      tmdbId: 42,
      type: "movie",
      wikipediaLanguage: "fr",
      dubbingLanguage: "fr-FR",
      pageId: 123,
      sectionIndexes: [2, 4],
      scanMetadata: standardMetadata,
      cache: new SimpleCache(() => null),
    });

    expect(result.ok).toBe(true);
    expect(requestedUrls.filter((url) => url.includes("prop=tocdata"))).toHaveLength(1);
    expect(requestedUrls.some((url) => url.includes("oldid=901"))).toBe(true);
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("rejects stale section headings after the pinned revision expires", async () => {
    const { requestedUrls } = setupExtractionFetch({
      stalePinnedRevision: true,
      changedHeading: true,
    });
    const result = await extractMediaDubbingCredits({
      tmdbId: 42,
      type: "movie",
      wikipediaLanguage: "fr",
      dubbingLanguage: "fr-FR",
      pageId: 123,
      sectionIndexes: [2, 4],
      scanMetadata: standardMetadata,
      cache: new SimpleCache(() => null),
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("headings changed"),
    });
    expect(requestedUrls.filter((url) => url.includes("prop=tocdata"))).toHaveLength(1);
    expect(extractionMocks.llmGenerateObject).not.toHaveBeenCalled();
    expect(extractionMocks.applyExtractedCredits).not.toHaveBeenCalled();
  });

  it("returns a retryable failure and persists nothing when one section fetch fails", async () => {
    setupExtractionFetch({ partialFailure: true });
    const result = await extractMediaDubbingCredits({
      tmdbId: 42,
      type: "movie",
      wikipediaLanguage: "fr",
      dubbingLanguage: "fr-FR",
      pageId: 123,
      sectionIndexes: [2, 4],
      scanMetadata: standardMetadata,
      cache: new SimpleCache(() => null),
    });

    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(extractionMocks.llmGenerateObject).not.toHaveBeenCalled();
    expect(extractionMocks.applyExtractedCredits).not.toHaveBeenCalled();
  });
});

describe("Wikipedia extraction prompt batching", () => {
  it("keeps multi-section attribution and splits oversized text without dropping content", () => {
    const original = "start\n" + "😀row|actor|voice\n".repeat(45) + "end";
    const batches = buildWikipediaExtractionBatches(
      [{ index: 9, heading: "Regional cast", wikitext: original }],
      240,
    );

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((batch) => batch.prompt.length <= 240)).toBe(true);
    expect(batches.every((batch) => batch.sectionIndexes.length > 0)).toBe(true);
    expect(
      batches
        .map((batch) => batch.prompt.replace(/\n\n<<< WIKIPEDIA SECTION #[^\n]+ >>>\n/g, ""))
        .join(""),
    ).toBe(original);
  });
});
