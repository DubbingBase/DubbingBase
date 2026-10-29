import { describe, expect, it } from "vitest";
import { mediaPageAggregateCredits, mediaPageMovieCredits } from "./media-page-credits";

describe("mediaPageAggregateCredits", () => {
  it("keeps page fields and roles without provider-only names or crew", () => {
    expect(
      mediaPageAggregateCredits({
        cast: [
          {
            id: 1,
            name: "Localized name",
            original_name: "Provider original name",
            profile_path: "/actor.jpg",
            roles: [{ character: "Lead", episode_count: 12, credit_id: "unused-credit" }],
          },
        ],
        crew: [{ id: 2, name: "Unused crew" }],
      }),
    ).toEqual({
      cast: [
        {
          id: 1,
          name: "Localized name",
          profile_path: "/actor.jpg",
          roles: [{ character: "Lead", episode_count: 12 }],
        },
      ],
    });
  });
});

describe("mediaPageMovieCredits", () => {
  it("keeps the movie page cast fields and source order", () => {
    expect(
      mediaPageMovieCredits({
        cast: [
          {
            id: 2,
            name: "Second actor",
            profile_path: "/second.jpg",
            character: "Second role",
            credit_id: "unused-credit",
            popularity: 12,
          },
          {
            id: 1,
            name: "First actor",
            profile_path: "/first.jpg",
            character: "First role",
            known_for_department: "Acting",
          },
        ],
        crew: [{ id: 99, name: "Unused crew" }],
      }),
    ).toEqual({
      cast: [
        { id: 2, name: "Second actor", profile_path: "/second.jpg", character: "Second role" },
        { id: 1, name: "First actor", profile_path: "/first.jpg", character: "First role" },
      ],
    });
  });
});
