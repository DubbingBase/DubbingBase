import { describe, expect, it } from "vitest";
import { wikiCheckDisposition } from "./wiki-check-disposition";

describe("wikiCheckDisposition", () => {
  it("archives candidate sections with no dubbing evidence when no region was requested", () => {
    expect(wikiCheckDisposition({ kind: "none" }, [2, 3])).toEqual({
      disposition: "no_dubbing_evidence",
    });
  });

  it("preserves a valid explicitly requested region when content has no regional marker", () => {
    expect(wikiCheckDisposition({ kind: "none" }, [2, 3], "fr-CA")).toEqual({
      disposition: "enqueue_extract",
      targets: [{ dubbingLanguage: "fr-CA", sectionIndexes: [2, 3] }],
    });
  });

  it("enqueues every resolved region independently", () => {
    expect(
      wikiCheckDisposition(
        {
          kind: "resolved",
          regions: [
            { language: "fr-FR", sectionIndexes: [3] },
            { language: "fr-CA", sectionIndexes: [4] },
          ],
        },
        [3, 4],
      ),
    ).toEqual({
      disposition: "enqueue_extract",
      targets: [
        { dubbingLanguage: "fr-FR", sectionIndexes: [3] },
        { dubbingLanguage: "fr-CA", sectionIndexes: [4] },
      ],
    });
  });

  it("selects only the requested region when multiple targets are present", () => {
    expect(
      wikiCheckDisposition(
        {
          kind: "resolved",
          regions: [
            { language: "fr-FR", sectionIndexes: [3] },
            { language: "fr-CA", sectionIndexes: [4] },
          ],
        },
        [3, 4],
        "fr-FR",
      ),
    ).toEqual({
      disposition: "enqueue_extract",
      targets: [{ dubbingLanguage: "fr-FR", sectionIndexes: [3] }],
    });
  });

  it("reports a controlled conflict when evidence resolves only to another region", () => {
    expect(
      wikiCheckDisposition(
        {
          kind: "resolved",
          regions: [{ language: "fr-CA", sectionIndexes: [4] }],
        },
        [4],
        "fr-FR",
      ),
    ).toMatchObject({ disposition: "target_conflict" });
  });

  it("routes genuine unknown-region evidence to review", () => {
    expect(
      wikiCheckDisposition(
        {
          kind: "ambiguous",
          sectionIndexes: [5],
          reasons: ["Dub credits have no market label."],
        },
        [5],
      ),
    ).toMatchObject({ disposition: "regional_review_required" });
  });

  it("does not silently reconcile ambiguous evidence with an explicit target", () => {
    expect(
      wikiCheckDisposition(
        {
          kind: "ambiguous",
          sectionIndexes: [5],
          reasons: ["Mixed market credits."],
        },
        [5],
        "fr-FR",
      ),
    ).toMatchObject({ disposition: "target_conflict" });
  });
});
