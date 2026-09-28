import { describe, expect, it } from "vitest";
import { wikiCheckDisposition } from "./wiki-check-disposition";

describe("Wikipedia section check disposition", () => {
  it("sends found dubbing sections without a regional target to review", () => {
    expect(wikiCheckDisposition(true, undefined)).toBe(
      "regional_review_required",
    );
  });

  it("queues extraction only with a registered dubbing region", () => {
    expect(wikiCheckDisposition(true, "fr-FR")).toBe("enqueue_extract");
    expect(wikiCheckDisposition(true, "fr")).toBe("regional_review_required");
  });

  it("does not create a review item when no dubbing sections exist", () => {
    expect(wikiCheckDisposition(false, undefined)).toBe("no_dubbing_sections");
  });
});
