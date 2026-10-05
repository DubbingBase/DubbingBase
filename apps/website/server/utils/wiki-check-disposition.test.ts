import { describe, expect, it } from "vitest";
import { wikiCheckDisposition } from "./wiki-check-disposition";

const resolvedEvidence = (
  regions: Array<{ language: "fr-FR" | "fr-CA"; sectionIndexes: number[] }>,
) => ({
  resolved: regions,
  unresolved: [],
});

describe("wikiCheckDisposition", () => {
  it("archives when there are no candidate sections", () => {
    expect(wikiCheckDisposition({ resolved: [], unresolved: [] }, [])).toEqual({
      disposition: "archive",
      reason: "no_candidate_sections",
      skipped: [],
    });
  });

  it("archives candidate sections without dubbing evidence even for an explicit target", () => {
    expect(wikiCheckDisposition({ resolved: [], unresolved: [] }, [2, 3], "fr-CA")).toEqual({
      disposition: "archive",
      reason: "no_dubbing_evidence",
      skipped: [],
    });
  });

  it("enqueues each resolved region and retains unresolved evidence as skipped", () => {
    expect(
      wikiCheckDisposition(
        {
          resolved: [{ language: "fr-FR", sectionIndexes: [3] }],
          unresolved: [
            {
              sectionIndexes: [7],
              reason: "ambiguous_region",
              details: "Unknown market.",
            },
          ],
        },
        [3, 7],
      ),
    ).toEqual({
      disposition: "enqueue_extract",
      targets: [{ dubbingLanguage: "fr-FR", sectionIndexes: [3] }],
      skipped: [
        {
          sectionIndexes: [7],
          reason: "ambiguous_region",
          details: "Unknown market.",
        },
      ],
    });
  });

  it("selects only the requested region when multiple regions are present", () => {
    expect(
      wikiCheckDisposition(
        resolvedEvidence([
          { language: "fr-FR", sectionIndexes: [3] },
          { language: "fr-CA", sectionIndexes: [4] },
        ]),
        [3, 4],
        "fr-FR",
      ),
    ).toEqual({
      disposition: "enqueue_extract",
      targets: [{ dubbingLanguage: "fr-FR", sectionIndexes: [3] }],
      skipped: [],
    });
  });

  it("archives an explicit target conflict without switching targets", () => {
    expect(
      wikiCheckDisposition(
        resolvedEvidence([{ language: "fr-CA", sectionIndexes: [4] }]),
        [4],
        "fr-FR",
      ),
    ).toEqual({
      disposition: "archive",
      reason: "target_conflict",
      details: "Requested fr-FR; detected fr-CA.",
      skipped: [],
    });
  });

  it("archives unresolved evidence as ambiguous or unsupported", () => {
    expect(
      wikiCheckDisposition(
        {
          resolved: [],
          unresolved: [{ sectionIndexes: [5], reason: "ambiguous_region" }],
        },
        [5],
      ),
    ).toMatchObject({ disposition: "archive", reason: "ambiguous_region" });
    expect(
      wikiCheckDisposition(
        {
          resolved: [],
          unresolved: [{ sectionIndexes: [6], reason: "unsupported_region" }],
        },
        [6],
      ),
    ).toMatchObject({ disposition: "archive", reason: "unsupported_region" });
  });
});
