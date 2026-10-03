import { describe, expect, it } from "vitest";
import { detectDubbingRegionFromWikitext } from "./dubbing-region-detection";

describe("detectDubbingRegionFromWikitext", () => {
  it("does not treat generic cast sections or bare VF/VQ tokens as dubbing evidence", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 1,
            heading: "Voice cast",
            wikitext: "{{Cast list|Actor One}}",
          },
          {
            index: 2,
            heading: "VF",
            wikitext: "The original cast appeared in VF Corporation's ad.",
          },
          {
            index: 3,
            heading: "Casting",
            wikitext: "VQ is the name of a character.",
          },
        ],
      }),
    ).toEqual({ kind: "none" });
  });

  it("does not treat a regional heading plus an original voice cast as dubbing evidence", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 6,
            heading: "LATAM voice cast",
            wikitext: "The original voice cast includes Ana Pérez and Luis García.",
          },
        ],
      }),
    ).toEqual({ kind: "none" });
  });

  it("does not use a dubbing or region phrase in the heading as content evidence", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 2,
            heading: "French (France) Dubbing",
            wikitext: "The original cast includes Jean Dupont and Marie Martin.",
          },
        ],
      }),
    ).toEqual({ kind: "none" });
  });

  it("resolves French France and Quebec only when their markers appear with dubbing credits", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 3,
            heading: "Version française",
            wikitext: "VF : Jean Dupont as Hero.",
          },
          {
            index: 7,
            heading: "Version québécoise",
            wikitext: "VQ : Marie Tremblay — Hero.",
          },
        ],
      }),
    ).toEqual({
      kind: "resolved",
      regions: [
        { language: "fr-CA", sectionIndexes: [7] },
        { language: "fr-FR", sectionIndexes: [3] },
      ],
    });
  });

  it("resolves supported Belgian French and Mexican Spanish markers from content", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 2,
            heading: "Voice cast",
            wikitext: "Belgian French dubbing cast: Jean Dupont.",
          },
          {
            index: 3,
            heading: "Voice cast",
            wikitext: "Mexican Spanish dubbing cast: Ana Pérez.",
          },
        ],
      }),
    ).toEqual({
      kind: "resolved",
      regions: [
        { language: "es-MX", sectionIndexes: [3] },
        { language: "fr-BE", sectionIndexes: [2] },
      ],
    });
  });

  it("resolves Brazilian and European Portuguese markers independently", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "pt",
        sections: [
          {
            index: 1,
            heading: "Brazilian Portuguese dub",
            wikitext: "Dublagem brasileira: Ana Silva.",
          },
          {
            index: 2,
            heading: "Dublagem portuguesa",
            wikitext: "European Portuguese dubbing: Rui Costa.",
          },
        ],
      }),
    ).toEqual({
      kind: "resolved",
      regions: [
        { language: "pt-BR", sectionIndexes: [1] },
        { language: "pt-PT", sectionIndexes: [2] },
      ],
    });
  });

  it("resolves Spain and Latin American Spanish markers independently", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 5,
            heading: "Doblaje español",
            wikitext: "Doblaje español: Ana Pérez.",
          },
          {
            index: 9,
            heading: "LATAM",
            wikitext: "LATAM Spanish dubbing: Luis García voices the hero.",
          },
        ],
      }),
    ).toEqual({
      kind: "resolved",
      regions: [
        { language: "es-ES", sectionIndexes: [5] },
        { language: "es-MX", sectionIndexes: [9] },
      ],
    });
  });

  it("returns ambiguous for credible dubbing evidence from a market it cannot map", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 4,
            heading: "Argentine dub",
            wikitext: "Argentine Spanish dubbing cast: Ana Pérez.",
          },
        ],
      }),
    ).toEqual({
      kind: "ambiguous",
      sectionIndexes: [4],
      reasons: ["unsupported_market"],
    });
  });

  it("uses explicit content evidence rather than the Wikipedia edition", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 4,
            heading: "Dubbing",
            wikitext: "Brazilian Portuguese dub: Ana Silva.",
          },
        ],
      }),
    ).toEqual({
      kind: "resolved",
      regions: [{ language: "pt-BR", sectionIndexes: [4] }],
    });
  });

  it("returns ambiguous when a section makes conflicting regional claims", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 8,
            heading: "Dubbing",
            wikitext:
              "French (France) dubbing cast and French Canadian dubbing cast are listed below.",
          },
        ],
      }),
    ).toEqual({
      kind: "ambiguous",
      sectionIndexes: [8],
      reasons: ["conflicting_markets"],
    });
  });
});
