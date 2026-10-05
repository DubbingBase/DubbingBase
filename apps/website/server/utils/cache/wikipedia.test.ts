import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "./index";
import {
  extractAvailableLanguages,
  filterValidSectionIndexes,
  isDubbingSectionHeading,
  selectDubbingCandidateSections,
  selectDubbingSections,
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

  it("rejects a section response containing only malformed sections", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ parse: { tocdata: { sections: [{}, { line: "Cast" }] } } })),
    );
    const cache = new WikipediaCache(new SimpleCache(() => null));

    await expect(cache.getPageSections(1, "en")).rejects.toThrow("invalid section list response");
  });
});

describe("isDubbingSectionHeading", () => {
  it.each([["Reparto principal"], ["Reparto"], ["Distribution"], ["Cast"]])(
    "recognizes generic heading %s as a candidate",
    (heading) => {
      expect(isDubbingSectionHeading(heading)).toBe(true);
    },
  );
  it.each([["Actores"], ["Argumento"]])("rejects unrelated heading %s", (heading) => {
    expect(isDubbingSectionHeading(heading)).toBe(false);
  });
  it.each([
    ["Reparto de doblaje"],
    ["Reparto de voces"],
    ["Doblaje"],
    ["Voces en español"],
    ["Doublage"],
  ])("recognizes explicit candidate heading %s", (heading) => {
    expect(isDubbingSectionHeading(heading)).toBe(true);
  });
});

describe("filterValidSectionIndexes", () => {
  const sections = [
    { index: 1, line: "Argumento" },
    { index: 2, line: "Reparto principal" },
    { index: 3, line: "Doblaje" },
  ];

  it("keeps stale indexes when their headings remain valid candidates", async () => {
    await expect(filterValidSectionIndexes(sections, [2])).resolves.toEqual([2]);
  });

  it("drops indexes whose headings are no longer candidates", async () => {
    await expect(
      filterValidSectionIndexes([...sections, { index: 4, line: "Plot" }], [2, 3, 4]),
    ).resolves.toEqual([2, 3]);
  });
});

describe("selectDubbingCandidateSections", () => {
  it.each([
    ["Distribution", "generic_cast"],
    ["Casting", "generic_cast"],
    ["Cast", "generic_cast"],
    ["Reparto", "generic_cast"],
    ["Reparto principal", "generic_cast"],
    ["Besetzung", "generic_cast"],
    ["Obsada", "generic_cast"],
    ["Starring", "generic_cast"],
    ["キャスト", "generic_cast"],
    ["配役", "generic_cast"],
    ["登場人物", "generic_cast"],
    ["Doublage", "explicit_dubbing"],
    ["Dubbing", "explicit_dubbing"],
    ["Version française", "explicit_dubbing"],
    ["Version québécoise", "explicit_dubbing"],
    ["Voice cast", "explicit_dubbing"],
    ["Synchronsprecher", "explicit_dubbing"],
    ["Doblaje", "explicit_dubbing"],
    ["Doppiaggio", "explicit_dubbing"],
    ["吹き替え", "explicit_dubbing"],
  ] as const)("classifies %s as a %s candidate", async (line, headingKind) => {
    await expect(selectDubbingCandidateSections([{ index: 7, line }])).resolves.toEqual([
      { index: 7, heading: line, headingKind },
    ]);
  });

  it("keeps explicit terms in a generic heading as an explicit candidate", async () => {
    await expect(
      selectDubbingCandidateSections([{ index: 3, line: "Reparto de doblaje" }]),
    ).resolves.toEqual([
      {
        index: 3,
        heading: "Reparto de doblaje",
        headingKind: "explicit_dubbing",
      },
    ]);
  });

  it("does not treat unrelated headings as candidates", async () => {
    await expect(selectDubbingCandidateSections([{ index: 4, line: "Plot" }])).resolves.toEqual([]);
  });
});

describe("selectDubbingSections compatibility", () => {
  it("forwards generic headings as candidates to legacy callers", async () => {
    await expect(
      selectDubbingSections([
        { index: 1, line: "Reparto" },
        { index: 2, line: "Reparto de doblaje" },
      ]),
    ).resolves.toEqual(["1", "2"]);
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
