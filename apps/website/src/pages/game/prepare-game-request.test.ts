import { describe, expect, it } from "vitest";
import { buildPrepareGameRequest } from "./prepare-game-request";

describe("game admin preparation request", () => {
  it("sends the Wikipedia source and dubbing region as distinct fields", () => {
    expect(buildPrepareGameRequest(42, "simple", "en-US")).toEqual({
      igdbId: 42,
      wikipedia_language: "simple",
      dubbing_language: "en-US",
    });
  });

  it.each([
    ["missing source", 42, "", "en-US"],
    ["invalid source", 42, "FR-fr", "en-US"],
    ["missing target", 42, "simple", ""],
    ["legacy target", 42, "simple", "en"],
    ["invalid id", Number.NaN, "simple", "en-US"],
  ])("does not build a request for %s", (_name, igdbId, source, target) => {
    expect(buildPrepareGameRequest(igdbId, source, target)).toBeNull();
  });
});
