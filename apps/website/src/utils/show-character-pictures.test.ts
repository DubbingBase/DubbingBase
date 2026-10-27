import { describe, expect, it } from "vitest";
import { findCharacterImage, indexCharacterPictures } from "./show-character-pictures";

describe("character picture index", () => {
  it("normalizes names and preserves the first match among duplicates", () => {
    const index = indexCharacterPictures([
      { name: "MARIO", image: "/first.jpg" },
      { name: "Mario", image: "/second.jpg" },
    ]);

    expect(findCharacterImage(index, ["mArIo"])).toBe("/first.jpg");
  });

  it("keeps the first match even when its image is null", () => {
    const index = indexCharacterPictures([
      { name: "Luigi", image: null },
      { name: "LUIGI", image: "/later.jpg" },
    ]);

    expect(findCharacterImage(index, ["luigi"])).toBeNull();
  });

  it("falls back through roles before the work character name", () => {
    const index = indexCharacterPictures([
      { name: "First Role", image: null },
      { name: "Second Role", image: "/role.jpg" },
      { name: "Work Name", image: "/work.jpg" },
    ]);

    expect(findCharacterImage(index, ["First Role", "Second Role", "Work Name"])).toBe(
      "/role.jpg",
    );
    expect(findCharacterImage(index, ["First Role", "Work Name"])).toBe("/work.jpg");
  });
});
