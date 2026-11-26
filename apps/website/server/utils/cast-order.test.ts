import { describe, expect, it } from "vitest";
import {
  applyCastPlacements,
  castOrderEtag,
  castOrderVersionFromEtag,
  castPlacementMessage,
} from "./cast-order";

// The same cases as packages/database/supabase/tests/security/game_cast_order.test.sql, so the
// dry run previews exactly what place_game_cast_characters writes.
describe("applyCastPlacements", () => {
  it("inserts a character at its rank and shifts the others", () => {
    expect(applyCastPlacements(["may", "martin"], [{ gameCharacterId: "peter", rank: 1 }])).toEqual(
      {
        ok: true,
        order: ["peter", "may", "martin"],
      },
    );
  });

  it("puts every ranked character exactly at its rank, whatever the request order", () => {
    // Peter is before Martin and moves after him: taking both out first keeps May in between.
    expect(
      applyCastPlacements(
        ["peter", "may", "martin"],
        [
          { gameCharacterId: "peter", rank: 3 },
          { gameCharacterId: "martin", rank: 1 },
        ],
      ),
    ).toEqual({ ok: true, order: ["martin", "may", "peter"] });
    expect(
      applyCastPlacements(
        ["b", "x", "a"],
        [
          { gameCharacterId: "a", rank: 2 },
          { gameCharacterId: "b", rank: 3 },
        ],
      ),
    ).toEqual({ ok: true, order: ["x", "a", "b"] });
  });

  it("takes a character out with null and closes the gap", () => {
    expect(
      applyCastPlacements(["martin", "may", "peter"], [{ gameCharacterId: "martin", rank: null }]),
    ).toEqual({ ok: true, order: ["may", "peter"] });
  });

  it("accepts the same character twice with the same rank", () => {
    expect(
      applyCastPlacements(
        ["may"],
        [
          { gameCharacterId: "peter", rank: 1 },
          { gameCharacterId: "peter", rank: 1 },
        ],
      ),
    ).toEqual({ ok: true, order: ["peter", "may"] });
  });

  it("refuses ties, conflicting ranks and ranks past the end", () => {
    expect(
      applyCastPlacements(
        ["a", "b"],
        [
          { gameCharacterId: "a", rank: 1 },
          { gameCharacterId: "b", rank: 1 },
        ],
      ),
    ).toEqual({ ok: false, reason: "duplicate_rank" });
    expect(
      applyCastPlacements(
        [],
        [
          { gameCharacterId: "peter", rank: 1 },
          { gameCharacterId: "peter", rank: 2 },
        ],
      ),
    ).toEqual({ ok: false, reason: "duplicate_character" });
    const past = applyCastPlacements(["a", "b", "c"], [{ gameCharacterId: "c", rank: 5 }]);
    expect(past).toEqual({ ok: false, reason: "past_end", rank: 5, highest: 3 });
    if (!past.ok) expect(castPlacementMessage(past)).toContain("highest allowed is 3");
  });
});

describe("cast order ETag", () => {
  it("round-trips the version and rejects other tags", () => {
    expect(castOrderVersionFromEtag(castOrderEtag(7))).toBe(7);
    expect(castOrderVersionFromEtag(castOrderEtag(0))).toBe(0);
    expect(castOrderVersionFromEtag('"2026-11-26T10:00:00Z"')).toBeNull();
  });
});
