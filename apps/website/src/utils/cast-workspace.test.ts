import { describe, expect, it } from "vitest";
import {
  filterCastRows,
  getInitials,
  pickOriginalCastSeed,
  type CastWorkspaceRow,
} from "./cast-workspace";

const row = (key: string, overrides: Partial<CastWorkspaceRow> = {}): CastWorkspaceRow => ({
  key,
  characterName: "",
  characterImage: null,
  originalActorName: "",
  originalActorImage: null,
  voiceActorName: "",
  voiceActorImage: null,
  performance: "dialogues",
  highlight: false,
  ...overrides,
});

describe("filterCastRows", () => {
  const rows = [
    row("a", {
      characterName: "Woody",
      originalActorName: "Tom Hanks",
      voiceActorName: "Jean Pierre",
    }),
    row("b", { characterName: "Woody" }),
    row("c"),
  ];

  it("returns every row for a blank query", () => {
    expect(filterCastRows(rows, "  ")).toHaveLength(3);
  });

  it("matches any identity field and keeps duplicate characters distinct by key", () => {
    expect(filterCastRows(rows, "woody").map((r) => r.key)).toEqual(["a", "b"]);
    expect(filterCastRows(rows, "HANKS").map((r) => r.key)).toEqual(["a"]);
    expect(filterCastRows(rows, "pierre").map((r) => r.key)).toEqual(["a"]);
    expect(filterCastRows(rows, "nobody")).toEqual([]);
  });
});

describe("getInitials", () => {
  it("uses up to two leading letters and tolerates empty names", () => {
    expect(getInitials("tom  hanks jr")).toBe("TH");
    expect(getInitials("")).toBe("");
  });
});

describe("pickOriginalCastSeed", () => {
  it("keeps billing order, skips members without a character and bounds the result", () => {
    const cast = [
      { id: 1, character: "Neo" },
      { id: 2, character: "  " },
      { id: 3, character: null },
      { id: 4, character: "Trinity" },
      { id: 5, character: "Morpheus" },
    ];
    expect(pickOriginalCastSeed(cast).map((m) => m.id)).toEqual([1, 4, 5]);
    expect(pickOriginalCastSeed(cast, 2).map((m) => m.id)).toEqual([1, 4]);
  });
});
