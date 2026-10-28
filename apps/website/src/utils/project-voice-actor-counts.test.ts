import { describe, expect, it } from "vitest";
import { countProjectVoiceActors } from "./project-voice-actor-counts";

describe("countProjectVoiceActors", () => {
  it("counts distinct actors and marks projects with actor records visible", () => {
    const result = countProjectVoiceActors([
      {
        id: 1,
        works: [
          { voice_actor: { id: 10 } },
          { voice_actor: { id: 10 } },
          { voice_actor: { id: 11 } },
          { voice_actor: null },
        ],
      },
      { id: 2, works: [{ voice_actor: { id: null } }] },
      { id: 3, works: [{ voice_actor: null }] },
      { id: 4, works: null },
    ]);

    expect(result.visibleProjectIds).toEqual(new Set([1, 2]));
    expect(result.countsByProjectId).toEqual(
      new Map([
        [1, 2],
        [2, 0],
        [3, 0],
        [4, 0],
      ]),
    );
  });
});
