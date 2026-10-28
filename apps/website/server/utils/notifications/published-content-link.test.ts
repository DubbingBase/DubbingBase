import { describe, expect, it } from "vitest";
import { publishedContentLink } from "./published-content-link";

describe("published content notification links", () => {
  it.each([
    ["movie", 123, "https://dubbingbase.com/fr/movie/123"],
    ["tv", 123, "https://dubbingbase.com/fr/show/123"],
    ["video_game", 123, "https://dubbingbase.com/fr/game/123"],
    ["audiobook", 123, "https://dubbingbase.com/fr/audiobook/123"],
  ])("maps %s to its public HTTPS route", (contentType, contentId, expected) => {
    expect(publishedContentLink(contentType, contentId)).toBe(expected);
  });

  it("rejects unknown and invalid content identities", () => {
    expect(publishedContentLink("actor", 1)).toBeNull();
    expect(publishedContentLink("movie", 0)).toBeNull();
    expect(publishedContentLink("movie", -1)).toBeNull();
  });
});
