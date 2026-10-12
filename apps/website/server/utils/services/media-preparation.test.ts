import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkMediaDubbingSections,
  extractGameDubbingCredits,
  extractMediaDubbingCredits,
} from "./media-preparation";
import { SimpleCache } from "../cache";
import type { ExtractedCredit } from "./voice-actor";
import {
  buildWikipediaExtractionBatches,
  deduplicateExtractedCredits,
} from "./wiki-extraction-batching";
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
    largeSections?: boolean;
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
            wikitext: options?.largeSections
              ? `section ${url.includes("section=2") ? "two" : "four"}\n${"credit row\n".repeat(4_000)}`
              : `section body ${url.includes("section=2") ? "two" : "four"}`,
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

  it.each(["movie", "tv"] as const)(
    "fetches validated %s sections concurrently and uses one regional LLM call",
    async (type) => {
      const extractionFetch = setupExtractionFetch();
      const { requestedUrls } = extractionFetch;
      const result = await extractMediaDubbingCredits({
        tmdbId: 42,
        type,
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
      expect(extractionMocks.llmGenerateObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          systemInstruction: expect.stringContaining("requested target dubbing region is fr-FR"),
        }),
      );
      expect(requestedUrls.filter((url) => url.includes("prop=wikitext"))).toHaveLength(2);
      expect(requestedUrls.some((url) => url.includes("prop=tocdata"))).toBe(false);
      expect(extractionFetch.maxConcurrentSectionRequests).toBe(2);
      expect(extractionMocks.applyExtractedCredits).toHaveBeenCalledWith(42, type, "fr-FR", [
        expect.objectContaining({ actorId: 700, performance: "Role One" }),
      ]);
    },
  );

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

  it("does not persist earlier batch results when a later LLM batch fails", async () => {
    setupExtractionFetch({ largeSections: true });
    extractionMocks.llmGenerateObject
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              actor: "Target Actor",
              voiceActorFirstname: "Alex",
              voiceActorName: "Dubber",
              performance: "Role One",
            },
          ],
        },
        model: "fixture-model",
      })
      .mockRejectedValueOnce(new Error("all LLM fallbacks failed"));

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

    expect(result.ok).toBe(false);
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledTimes(2);
    expect(extractionMocks.applyExtractedCredits).not.toHaveBeenCalled();
  });

  it("preserves IGDB character mappings while using the shared batched extraction", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "test-id",
      igdbClientSecret: "test-secret",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("id.twitch.tv")) {
          return new Response(JSON.stringify({ access_token: "fixture-token", expires_in: 3600 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("api.igdb.com")) {
          return new Response(JSON.stringify([{ id: 77, name: "Target Character" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ parse: { revid: 900, wikitext: "validated game credits" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    extractionMocks.llmGenerateObject.mockResolvedValue({
      data: {
        items: [
          {
            actor: "Target Character",
            voiceActorFirstname: "Alex",
            voiceActorName: "Dubber",
            performance: "Role One",
          },
        ],
      },
      model: "fixture-model",
    });

    const result = await extractGameDubbingCredits({
      igdbId: 42,
      wikipediaLanguage: "fr",
      dubbingLanguage: "fr-FR",
      pageId: 123,
      sectionIndexes: [2],
      scanMetadata: {
        ...standardMetadata,
        sectionHeadings: ["Dubbing cast"],
      },
      cache: new SimpleCache(() => null),
    });

    expect(result).toMatchObject({ ok: true, title: "Fixture Film" });
    expect(extractionMocks.llmGenerateObject).toHaveBeenCalledTimes(1);
    expect(extractionMocks.applyExtractedCredits).toHaveBeenCalledWith(42, "video_game", "fr-FR", [
      expect.objectContaining({ actorId: 77, performance: "Role One" }),
    ]);
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

  it("keeps each multiline wikitable row and its table headings together", () => {
    const batches = buildWikipediaExtractionBatches(
      [
        {
          index: 12,
          heading: "Regional dubbing cast",
          wikitext: [
            '{| class="wikitable"',
            "! Character",
            "! Actor",
            "! Voice actor",
            "|-",
            "! Character Alpha",
            "| Actor Alpha",
            "| Voice Alpha",
            "|-",
            "! Character Beta",
            "| Actor Beta",
            "| Voice Beta",
            "|}",
            "",
          ].join("\n"),
        },
      ],
      200,
    );

    expect(batches.length).toBeGreaterThan(1);
    expect(
      batches.every(
        (batch) => batch.prompt.includes('{| class="wikitable"') && batch.prompt.includes("|}"),
      ),
    ).toBe(true);
    expect(
      ["Alpha", "Beta"].every((name) =>
        batches.some(
          (batch) =>
            batch.prompt.includes(`Character ${name}`) &&
            batch.prompt.includes(`Actor ${name}`) &&
            batch.prompt.includes(`Voice ${name}`),
        ),
      ),
    ).toBe(true);
  });

  it("repeats leading Wikimedia column headers and packs complete rows", () => {
    const rows = Array.from({ length: 8 }, (_, index) => {
      const id = String(index + 1).padStart(2, "0");
      return `|- class="${index % 2 === 0 ? "even" : "odd"}"\n| [[Character ${id}]] || [[Actor ${id}]] || [[Voice ${id}]]`;
    });
    const section = {
      index: 24,
      heading: "Version française — distribution doublée",
      wikitext: [
        '{| class="wikitable sortable"',
        "|-",
        '! scope="col" | Personnage !! Acteur original !! Voix française',
        ...rows,
        "|}",
        "",
      ].join("\n"),
    };

    const batches = buildWikipediaExtractionBatches([section], 400);
    const repeated = buildWikipediaExtractionBatches([section], 400);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.length).toBeLessThan(rows.length);
    expect(repeated).toEqual(batches);
    expect(batches.every((batch) => batch.prompt.length <= 400)).toBe(true);
    const fragmentLabels = batches.flatMap(
      ({ prompt }) => prompt.match(/<<< WIKIPEDIA SECTION #24:.*part \d+\/\d+ >>>/g) ?? [],
    );
    expect(fragmentLabels.length).toBeLessThan(rows.length);
    expect(
      batches.every(
        ({ prompt }) =>
          prompt.includes("Personnage !! Acteur original !! Voix française") &&
          prompt.includes('{| class="wikitable sortable"') &&
          prompt.includes("|}"),
      ),
    ).toBe(true);
    for (const row of rows) {
      expect(batches.filter(({ prompt }) => prompt.includes(row))).toHaveLength(1);
    }
    expect(batches.every(({ prompt }) => prompt.includes(section.heading))).toBe(true);
  });

  it("does not repeat an initial data row when Wikimedia omits its first row separator", () => {
    const firstDataRow = "| [[Character A]] || [[Actor A]] || [[Voice A]]";
    const laterRows = [
      '|- class="even"\n| [[Character B]] || [[Actor B]] || [[Voice B]]',
      '|- class="odd"\n| [[Character C]] || [[Actor C]] || [[Voice C]]',
      '|- class="even"\n| [[Character D]] || [[Actor D]] || [[Voice D]]',
    ];
    const section = {
      index: 26,
      heading: "Version française",
      wikitext: [
        '{| class="wikitable"',
        "! Personnage !! Acteur original !! Voix française",
        firstDataRow,
        ...laterRows,
        "|}",
      ].join("\n"),
    };

    const batches = buildWikipediaExtractionBatches([section], 300);

    expect(batches.length).toBeGreaterThan(1);
    expect(
      batches.every(({ prompt }) =>
        prompt.includes("Personnage !! Acteur original !! Voix française"),
      ),
    ).toBe(true);
    for (const row of [firstDataRow, ...laterRows]) {
      expect(batches.filter(({ prompt }) => prompt.includes(row))).toHaveLength(1);
    }
  });

  it("keeps actual part labels within the prompt limit above 999 fragments", () => {
    const rows = Array.from(
      { length: 1_005 },
      (_, index) =>
        `|-\n| Character ${index} || Actor ${index} || Voice ${index} | ${"x".repeat(24)}`,
    );
    const section = {
      index: 25,
      heading: "Dubbing cast",
      wikitext: ['{| class="wikitable"', "|-", "! Character !! Actor !! Voice", ...rows, "|}"].join(
        "\n",
      ),
    };

    const batches = buildWikipediaExtractionBatches([section], 250);
    const fragmentLabels = batches.flatMap(
      ({ prompt }) => prompt.match(/<<< WIKIPEDIA SECTION #25:.*part \d+\/\d+ >>>/g) ?? [],
    );

    expect(fragmentLabels.length).toBeGreaterThan(999);
    expect(batches.every((batch) => batch.prompt.length <= 250)).toBe(true);
    expect(batches[0]?.prompt).toContain("part 1/");
    expect(batches.at(-1)?.prompt).toContain(`part ${batches.length}/${batches.length}`);
    expect(batches.every(({ prompt }) => prompt.includes("! Character !! Actor !! Voice"))).toBe(
      true,
    );
  });

  it("refuses to split a single table row across actor and voice cells", () => {
    expect(() =>
      buildWikipediaExtractionBatches(
        [
          {
            index: 12,
            heading: "Regional dubbing cast",
            wikitext: [
              '{| class="wikitable"',
              "! Character",
              "! Actor",
              "! Voice actor",
              "|-",
              `! ${"A".repeat(100)}`,
              "| Actor Alpha",
              "| Voice Alpha",
              "|}",
            ].join("\n"),
          },
        ],
        150,
      ),
    ).toThrow("refusing to split actor/character cells");
  });

  it("refuses to split oversized tables with cross-row rowspan relationships", () => {
    expect(() =>
      buildWikipediaExtractionBatches(
        [
          {
            index: 12,
            heading: "Regional dubbing cast",
            wikitext: [
              '{| class="wikitable"',
              "! Character",
              "! Voice actor",
              "|-",
              "! Character Alpha",
              '| rowspan="2" | Shared voice actor',
              "|-",
              "! Character Beta",
              "| Another voice actor",
              "|}",
            ].join("\n"),
          },
        ],
        200,
      ),
    ).toThrow("cross-row cell relationships");
  });

  it("removes duplicate rows while retaining a voice actor's distinct roles", () => {
    const credit: ExtractedCredit = {
      actorId: 700,
      firstname: "Alex",
      lastname: "Dubber",
      performance: "Role One",
    };

    expect(
      deduplicateExtractedCredits([
        credit,
        { ...credit, firstname: "alex", lastname: "DUBBER" },
        { ...credit, performance: "Role Two" },
      ]),
    ).toEqual([credit, { ...credit, performance: "Role Two" }]);
  });
});
