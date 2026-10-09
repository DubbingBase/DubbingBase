import { describe, expect, it } from "vitest";
import { detectDubbingRegionFromWikitext } from "./dubbing-region-detection";

const noEvidence = { resolved: [], unresolved: [] };

describe("detectDubbingRegionFromWikitext", () => {
  it("keeps generic Spanish dubbing unresolved without Spain or LATAM evidence", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [{ index: 1, heading: "Doblaje", wikitext: "Doblaje español: Luis." }],
      }),
    ).toEqual({
      resolved: [],
      unresolved: [{ sectionIndexes: [1], reason: "ambiguous_region" }],
    });
  });

  it("does not identify translators or directors as Catalan performers", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 1,
            heading: "Doblaje",
            wikitext:
              "El director Enric Isasi-Isasmendi en la versión en catalán y el traductor Tacho González en la versión en gallego.",
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("requires a named dubbed actor beneath a regional column", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "pt",
        sections: [
          {
            index: 2,
            heading: "Elenco",
            wikitext:
              '{| class="wikitable"\n! Personagens !! Original !! Brasil !! Portugal\n|-\n| Alice || Mia Wasikowska || Ana Lúcia Menezes ||\n|}\n* Direcção de dobragem: Carlos Freixo',
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "pt-BR", sectionIndexes: [2] }],
      unresolved: [],
    });
  });

  it("does not treat country-labelled adaptation casts as dubbed voices", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "pt",
        sections: [
          {
            index: 2,
            heading: "Elenco",
            wikitext:
              '{| class="wikitable"\n! Personagens !! Original !! Brasil !! Portugal\n|-\n| Alice || Mia Wasikowska || Ana Lúcia Menezes || Tobias Monteiro\n|}',
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("ignores a regional voice column when only original performers are populated", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 1,
            heading: "Distribution",
            wikitext:
              '{| class="wikitable"\n! Personnage !! Voix originale !! Voix française\n|-\n| Anna || Kristen Bell ||\n|}',
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("recognizes paired character and voice actor labels under a regional heading", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 2,
            heading: "Version française",
            wikitext: "Character: Hero\nVoice actor: Jean",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [2] }],
      unresolved: [],
    });
  });

  it("recognizes a dubbed cast table after an unrelated table", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 2,
            heading: "Version française",
            wikitext:
              '{| class="wikitable"\n! Season !! Episodes\n|-\n| 1 || 10\n|}\n{| class="wikitable"\n! Character !! Actor\n|-\n| Hero || Jean\n|}',
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [2] }],
      unresolved: [],
    });
  });

  it.each(["Distribution", "Cast"])("ignores an ordinary cast under %s", (heading) => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 1,
            heading,
            wikitext: "* Actor One\n* Actor Two",
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("does not infer an unsupported dubbing market from an actor's nationality", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 11,
            heading: "Distribution",
            wikitext:
              '{| class="wikitable"\n| Character || Actor\n| Hero || Ana Pérez (Argentine actress)\n|}',
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("ignores an explicitly original voice cast", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 6,
            heading: "Voice cast",
            wikitext: "The original voice cast includes Ana Pérez and Luis García.",
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("does not let a regional dubbing heading alone establish evidence", () => {
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
    ).toEqual(noEvidence);
  });

  it("ignores unrelated VF acronym text", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 12,
            heading: "Cast",
            wikitext: "VF Corporation sponsored the original actors.",
          },
        ],
      }),
    ).toEqual(noEvidence);
  });

  it("uses Version française plus a credit-shaped character/actor table", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 3,
            heading: "Version française",
            wikitext: '{| class="wikitable"\n| Character || Actor\n| Hero || Jean Dupont\n|}',
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [3] }],
      unresolved: [],
    });
  });

  it("uses Version québécoise plus a credit-shaped table", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 4,
            heading: "Version québécoise",
            wikitext: '{| class="wikitable"\n| Character || Actor\n| Hero || Marie Tremblay\n|}',
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-CA", sectionIndexes: [4] }],
      unresolved: [],
    });
  });

  it("recognizes a regional credit table after an unrelated first table", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 10,
            heading: "Version française",
            wikitext:
              '{| class="wikitable"\n| Release date || Director\n| 2020 || Jane\n|}\n' +
              '{| class="wikitable"\n| Character || Actor\n| Hero || Jean Dupont\n|}',
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [10] }],
      unresolved: [],
    });
  });

  it("recognizes conservative colon-form character and actor lists", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 11,
            heading: "Version française",
            wikitext: "Character: Hero\nVoice actor: Jean Dupont",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [11] }],
      unresolved: [],
    });
  });

  it("resolves an inline VF credit without relying on its heading", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 5,
            heading: "Distribution",
            wikitext: "VF : Jean Dupont as Hero.",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [5] }],
      unresolved: [],
    });
  });

  it("resolves Digger-style VF entries", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 8,
            heading: "Distribution",
            wikitext: "VF : John Digger\nVF : Jeanne Actrice",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [8] }],
      unresolved: [],
    });
  });

  it("resolves isolated VF credits in a mixed original cast section", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 9,
            heading: "Cast",
            wikitext: "Original voice cast: Actor One and Actor Two.\n* Hero — VF: Jean Dupont",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [9] }],
      unresolved: [],
    });
  });

  it("resolves separate VF and VQ sections independently", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          { index: 3, heading: "Distribution", wikitext: "VF : Jean Dupont" },
          {
            index: 7,
            heading: "Distribution",
            wikitext: "VQ : Marie Tremblay",
          },
        ],
      }),
    ).toEqual({
      resolved: [
        { language: "fr-CA", sectionIndexes: [7] },
        { language: "fr-FR", sectionIndexes: [3] },
      ],
      unresolved: [],
    });
  });

  it("returns resolved regions alongside a separate unknown-market section", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          { index: 3, heading: "Distribution", wikitext: "VF : Jean Dupont" },
          {
            index: 7,
            heading: "Dubbing",
            wikitext: "Japanese dub: Actor Name",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [3] }],
      unresolved: [{ sectionIndexes: [7], reason: "ambiguous_region" }],
    });
  });

  it("returns resolved regions alongside a separate unsupported-market section", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          { index: 3, heading: "Distribution", wikitext: "VF : Jean Dupont" },
          {
            index: 7,
            heading: "Dubbing",
            wikitext: "Argentine Spanish dubbing cast: Ana Pérez.",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "fr-FR", sectionIndexes: [3] }],
      unresolved: [
        {
          sectionIndexes: [7],
          reason: "unsupported_region",
          details: "Argentine Spanish",
        },
      ],
    });
  });

  it("marks a known unsupported Argentine market as unsupported_region", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 4,
            heading: "Dubbing",
            wikitext: "Argentine Spanish dubbing cast: Ana Pérez.",
          },
        ],
      }),
    ).toEqual({
      resolved: [],
      unresolved: [
        {
          sectionIndexes: [4],
          reason: "unsupported_region",
          details: "Argentine Spanish",
        },
      ],
    });
  });

  it("does not mistake an actor's nationality for an unsupported dubbing market", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "es",
        sections: [
          {
            index: 5,
            heading: "Dubbing",
            wikitext:
              '{| class="wikitable"\n| Character || Actor\n| Hero || Ana Pérez (Argentine actress)\n|}',
          },
        ],
      }),
    ).toEqual({
      resolved: [],
      unresolved: [{ sectionIndexes: [5], reason: "ambiguous_region" }],
    });
  });

  it("uses supported Belgian French and Mexican Spanish markers", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "en",
        sections: [
          {
            index: 2,
            heading: "Cast",
            wikitext: "Belgian French dubbing cast: Jean.",
          },
          {
            index: 3,
            heading: "Cast",
            wikitext: "Mexican Spanish dubbing cast: Ana.",
          },
        ],
      }),
    ).toEqual({
      resolved: [
        { language: "es-MX", sectionIndexes: [3] },
        { language: "fr-BE", sectionIndexes: [2] },
      ],
      unresolved: [],
    });
  });

  it("resolves Brazilian and European Portuguese, Spain and LATAM Spanish", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "pt",
        sections: [
          {
            index: 1,
            heading: "Cast",
            wikitext: "Brazilian Portuguese dubbing: Ana.",
          },
          {
            index: 2,
            heading: "Cast",
            wikitext: "European Portuguese dubbing: Rui.",
          },
          { index: 3, heading: "Cast", wikitext: "Doblaje castellano: Luis." },
          {
            index: 4,
            heading: "Cast",
            wikitext: "LATAM Spanish dubbing: Maria.",
          },
        ],
      }),
    ).toEqual({
      resolved: [
        { language: "es-ES", sectionIndexes: [3] },
        { language: "es-MX", sectionIndexes: [4] },
        { language: "pt-BR", sectionIndexes: [1] },
        { language: "pt-PT", sectionIndexes: [2] },
      ],
      unresolved: [],
    });
  });

  it("uses content evidence rather than the Wikipedia edition", () => {
    expect(
      detectDubbingRegionFromWikitext({
        wikipediaLanguage: "fr",
        sections: [
          {
            index: 4,
            heading: "Cast",
            wikitext: "Brazilian Portuguese dub: Ana Silva.",
          },
        ],
      }),
    ).toEqual({
      resolved: [{ language: "pt-BR", sectionIndexes: [4] }],
      unresolved: [],
    });
  });

  it("returns ambiguous_region when one section claims conflicting supported regions", () => {
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
      resolved: [],
      unresolved: [
        {
          sectionIndexes: [8],
          reason: "ambiguous_region",
          details: "Conflicting regional markers",
        },
      ],
    });
  });
});
