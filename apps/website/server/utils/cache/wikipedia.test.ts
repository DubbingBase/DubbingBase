import { describe, expect, it } from "vitest";
import { isDubbingSectionHeading } from "./wikipedia";

describe("isDubbingSectionHeading", () => {
  it.each([["Reparto principal"], ["Reparto"], ["Actores"], ["Argumento"]])(
    "rejects plain cast heading %s",
    (heading) => {
      expect(isDubbingSectionHeading(heading)).toBe(false);
    },
  );

  it.each([
    ["Reparto de doblaje"],
    ["Reparto de voces"],
    ["Doblaje"],
    ["Voces en español"],
    ["Doublage"],
  ])("matches dubbing heading %s", (heading) => {
    expect(isDubbingSectionHeading(heading)).toBe(true);
  });
});
