import { describe, expect, it } from "vitest";
import { moveItem, sortRowsByCastRank } from "./game-cast-order";

describe("sortRowsByCastRank", () => {
  it("puts ranked rows first by rank and keeps the loaded order otherwise", () => {
    const rows = [
      { name: "Aunt May", rank: null },
      { name: "Miles", rank: 2 },
      { name: "Martin Li", rank: null },
      { name: "Peter", rank: 1 },
    ];
    expect(sortRowsByCastRank(rows, (row) => row.rank).map((row) => row.name)).toEqual([
      "Peter",
      "Miles",
      "Aunt May",
      "Martin Li",
    ]);
  });
});

describe("moveItem", () => {
  const items = ["a", "b", "c", "d"];

  it("moves an item up or down", () => {
    expect(moveItem(items, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("clamps the target and ignores no-op or invalid moves", () => {
    expect(moveItem(items, 0, 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveItem(items, 1, 1)).toEqual(items);
    expect(moveItem(items, 9, 0)).toEqual(items);
  });
});
