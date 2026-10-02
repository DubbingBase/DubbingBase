import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "./index";
import {
  extractAvailableLanguages,
  filterValidSectionIndexes,
  isDubbingSectionHeading,
  WikipediaCache,
} from "./wikipedia";

const noPersistentWikipediaRequests: Array<[string, (cache: WikipediaCache) => Promise<unknown>]> =
  [
    ["category lists", (cache) => cache.getMaleVoiceActors()],
    ["category lists", (cache) => cache.getFemaleVoiceActors()],
    ["section metadata", (cache) => cache.getPageSections(1, "fr")],
    ["HTML sections", (cache) => cache.getPageContentAsHTML(1, "2", "fr")],
    ["wikitext pages", (cache) => cache.getPageContentAsWikitext(1, "2", "fr")],
    ["wikitext sections", (cache) => cache.getPageSectionAsWikitext(1, "2", "fr")],
    ["page info", (cache) => cache.getWikipediaPageInfo("Example", "fr")],
    ["image URLs", (cache) => cache.getImageFromFilename("Example.jpg", "fr")],
    ["Wikidata search", (cache) => cache.searchWikidataEntities("Example", "en")],
  ];

afterEach(() => vi.unstubAllGlobals());

describe("Wikipedia cache policies", () => {
  it.each(noPersistentWikipediaRequests)(
    "does not read or write KV for %s",
    async (_label, request) => {
      let reads = 0;
      let writes = 0;
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ parse: { sections: [] } })));
      const cache = new WikipediaCache(
        new SimpleCache(() => ({
          get: async () => {
            reads += 1;
            return null;
          },
          put: async () => {
            writes += 1;
          },
        })),
      );

      await request(cache);

      expect(reads).toBe(0);
      expect(writes).toBe(0);
    },
  );

  it("persists stable Wikidata sitelink mappings", async () => {
    let reads = 0;
    let writes = 0;
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ entities: { Q42: { sitelinks: {} } } })),
    );
    const cache = new WikipediaCache(
      new SimpleCache(() => ({
        get: async () => {
          reads += 1;
          return null;
        },
        put: async () => {
          writes += 1;
        },
      })),
    );

    await cache.getAllSitelinksEntity("Q42");

    expect(reads).toBe(1);
    expect(writes).toBe(1);
  });
});

describe("isDubbingSectionHeading", () => {
  it.each([["Reparto principal"], ["Reparto"], ["Actores"], ["Argumento"]])(
    "rejects plain cast heading %s",
    (heading) => {
      expect(isDubbingSectionHeading(heading)).toBe(false);
    },
  );

  it.each([
    ["Reparto de doblaje"],
    ["Reparto de voces"],
    ["Doblaje"],
    ["Voces en español"],
    ["Doublage"],
  ])("matches dubbing heading %s", (heading) => {
    expect(isDubbingSectionHeading(heading)).toBe(true);
  });
});

describe("filterValidSectionIndexes", () => {
  const sections = [
    { index: 1, line: "Argumento" },
    { index: 2, line: "Reparto principal" },
    { index: 3, line: "Doblaje" },
  ];

  it("drops stale indexes (e.g. bare Reparto enqueued before the fix)", async () => {
    await expect(filterValidSectionIndexes(sections, [2])).resolves.toEqual([]);
  });

  it("keeps indexes that still match dubbing headings", async () => {
    await expect(filterValidSectionIndexes(sections, [2, 3])).resolves.toEqual([3]);
  });
});

describe("extractAvailableLanguages", () => {
  it("does not expose the Simple Wikipedia edition as a runtime source option", () => {
    expect(
      extractAvailableLanguages({
        simplewiki: { title: "Simple English article" },
        enwiki: { title: "English article" },
        frwiki: { title: "Article français" },
      }),
    ).toEqual(["fr", "en"]);
  });
});
