import { describe, expect, it } from "vitest";
import type { SearchResult } from "@app/shared-logic";
import { getSearchResultRoute } from "./search-routes";

const routeCases: Array<[SearchResult["media_type"], string]> = [
  ["movie", "/movie/42"],
  ["tv", "/show/42"],
  ["person", "/actor/42"],
  ["voice_actor", "/voice-actor/42"],
  ["video_game", "/game/42"],
  ["audiobook", "/audiobook/42"],
  ["podcast", "/podcast/42"],
  ["advertisement", "/advertisement/42"],
  ["toy", "/toy/42"],
];

describe("getSearchResultRoute", () => {
  it.each(routeCases)(
    "builds a route for %s results",
    (mediaType, expected) => {
      expect(getSearchResultRoute({ id: 42, media_type: mediaType })).toBe(
        expected,
      );
    },
  );
});
