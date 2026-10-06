import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import corpus from "./fixtures/wikipedia-dubbing/manifest.json";
import { selectDubbingCandidateSections } from "./cache/wikipedia";
import { detectDubbingRegionFromWikitext } from "./dubbing-region-detection";

describe("revision-pinned Wikipedia dubbing corpus", () => {
  it("does not classify Over There's source/production notes as performer credits", () => {
    const page = corpus.pages.find(({ id }) => id === "fr-over-there");
    const source = page?.sections[0];
    if (!page || !source) throw new Error("Missing Over There source fixture");
    const offset = source.wikitext.indexOf("*; Version française :");
    expect(offset).toBeGreaterThanOrEqual(0);
    // An exact source fragment, not a claim that the whole page has no dubbed cast.
    const productionNotes = source.wikitext.slice(offset);
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: page.language,
        sections: [
          {
            index: source.index,
            heading: source.heading,
            wikitext: productionNotes,
          },
        ],
      }),
    ).toEqual({ resolved: [], unresolved: [] });
  });

  for (const page of corpus.pages) {
    it(`${page.id}: selects the relevant real headings`, async () => {
      const candidates = await selectDubbingCandidateSections(
        page.sections.map(({ index, heading }) => ({ index, line: heading })),
      );
      expect(candidates.map(({ index }) => index)).toEqual(
        page.sections.filter(({ candidate }) => candidate).map(({ index }) => index),
      );
    });

    for (const section of page.sections) {
      it(`${page.id} revision ${page.revisionId}, section ${section.index}: ${section.heading}`, () => {
        expect(createHash("sha256").update(section.wikitext, "utf8").digest("hex")).toBe(
          section.sha256,
        );
        expect(
          detectDubbingRegionFromWikitext({
            wikipediaLanguage: page.language,
            sections: [section],
          }),
        ).toEqual(section.expected);
        // Relabeling the edition cannot change evidence from the same source text.
        expect(
          detectDubbingRegionFromWikitext({
            wikipediaLanguage: "en",
            sections: [section],
          }),
        ).toEqual(section.expected);
      });
    }
  }
});
