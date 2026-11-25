import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { route } from "../../api/v1/[type]/[id]/credits/[workId].patch";

const body = route.docs.body;
if (!body) throw new Error("The credit PATCH route declares no body");
const GAME_CHARACTER = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

describe("PATCH credit body", () => {
  it("completes a nameless credit with only the fields sent", () => {
    const parsed = v.safeParse(body, {
      character_name: "  Geralt of Rivia ",
      game_character_id: GAME_CHARACTER,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.output).toEqual({
      character_name: "Geralt of Rivia",
      game_character_id: GAME_CHARACTER,
    });
  });

  it("still accepts a performance-only change", () => {
    expect(v.safeParse(body, { performance: "narration" }).success).toBe(true);
  });

  it.each([
    ["an empty body", {}],
    ["a blank name", { character_name: "   " }],
    ["a cleared name", { character_name: null }],
    ["a cast id with a game character", { actor_id: 5, game_character_id: GAME_CHARACTER }],
    ["an unknown field", { reviewed_status: "accepted" }],
  ])("rejects %s", (_label, input) => {
    expect(v.safeParse(body, input).success).toBe(false);
  });
});
