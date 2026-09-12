import { describe, expect, it } from "vitest";
import {
  filterValidSectionIndexes,
  isDubbingSectionHeading,
} from "./wikipedia";

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
    await expect(filterValidSectionIndexes(sections, [2, 3])).resolves.toEqual([
      3,
    ]);
  });
});
