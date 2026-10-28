import { describe, expect, it } from "vitest";
import { matchCastWorks, sameMediaId } from "./media-cast";

describe("matchCastWorks", () => {
  it("keeps every work when multiple voice actors share an actor", () => {
    const result = matchCastWorks(
      [{ id: 10 }],
      [
        { id: 1, actor_id: 10 },
        { id: 2, actor_id: 10 },
      ],
    );

    expect(result.matches[0]?.works.map((work) => work.id)).toEqual([1, 2]);
    expect(result.unmatchedWorks).toEqual([]);
  });

  it("returns works whose actor is absent from the media credits", () => {
    const result = matchCastWorks(
      [{ id: 10 }],
      [
        { id: 1, actor_id: 10 },
        { id: 2, actor_id: 99 },
        { id: 3, actor_id: null },
      ],
    );

    expect(result.unmatchedWorks.map((work) => work.id)).toEqual([2, 3]);
  });

  it("preserves work order and numeric/string actor ID matching", () => {
    const result = matchCastWorks(
      [{ id: 10 }, { id: 11 }],
      [
        { id: 1, actor_id: "10" },
        { id: 2, actor_id: 10 },
        { id: 3, actor_id: null },
        { id: 4, actor_id: 99 },
      ],
    );

    expect(result.matches.map(({ works }) => works.map(({ id }) => id))).toEqual([[1, 2], []]);
    expect(result.unmatchedWorks.map(({ id }) => id)).toEqual([3, 4]);
  });

  it("keeps each actor's matching work bucket and unmatched work IDs stable", () => {
    const result = matchCastWorks(
      [{ id: 10 }, { id: 10 }],
      [
        { id: 1, actor_id: 10 },
        { id: 2, actor_id: 99 },
        { id: 1, actor_id: null },
      ],
    );

    expect(result.matches.map(({ works }) => works.map(({ id }) => id))).toEqual([[1], [1]]);
    expect(result.matches[0]?.works).not.toBe(result.matches[1]?.works);
    expect(result.unmatchedWorks.map(({ actor_id }) => actor_id)).toEqual([99]);
  });
});

describe("sameMediaId", () => {
  it("matches equivalent numeric IDs regardless of serialization", () => {
    expect(sameMediaId("123", 123)).toBe(true);
    expect(sameMediaId("123", 124)).toBe(false);
    expect(sameMediaId(null, 123)).toBe(false);
  });
});
