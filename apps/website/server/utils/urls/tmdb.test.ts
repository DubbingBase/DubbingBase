import { describe, expect, it } from "vitest";
import { processMedia } from "./tmdb";

describe("processMedia credits projection", () => {
  it("preserves credits by default", () => {
    const media = {
      credits: {
        cast: [{ id: 1, character: "Role", profile_path: "/actor.jpg" }],
        crew: [{ id: 3, name: "Crew member" }],
      },
    };

    expect(processMedia(media).credits).toEqual({
      cast: [
        {
          id: 1,
          character: "Role",
          profile_path: "https://image.tmdb.org/t/p/w500/actor.jpg",
        },
      ],
      crew: [{ id: 3, name: "Crew member" }],
    });
  });
});
