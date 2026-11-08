import { describe, expect, it, vi } from "vitest";
import {
  resolveCharacterImage,
  selectTvdbCharacter,
  type CharacterImageResolver,
} from "./character-images";

describe("selectTvdbCharacter", () => {
  const movie671 = [
    { id: 1, name: "Ron Weasley", image: "https://artworks.thetvdb.com/ron-2001.jpg" },
    { id: 2, name: "Harry Potter", image: "https://artworks.thetvdb.com/harry.jpg" },
  ];
  const movie672 = [
    { id: 9, name: "Ron Weasley", image: "https://artworks.thetvdb.com/ron-2002.jpg" },
  ];

  it("resolves the two Ron Weasley movies separately from their own production", () => {
    expect(selectTvdbCharacter(["Ron Weasley"], movie671)).toEqual({
      id: "1",
      image: "https://artworks.thetvdb.com/ron-2001.jpg",
    });
    expect(selectTvdbCharacter(["ron weasley (voice)"], movie672)).toEqual({
      id: "9",
      image: "https://artworks.thetvdb.com/ron-2002.jpg",
    });
  });

  it("tries candidate names in order", () => {
    expect(selectTvdbCharacter(["Unknown", "Harry Potter"], movie671)?.id).toBe("2");
  });

  it("rejects ambiguous, missing and non-http matches", () => {
    expect(selectTvdbCharacter(["Ron Weasley"], [...movie671, ...movie672])).toBeNull();
    expect(selectTvdbCharacter(["Hermione Granger"], movie671)).toBeNull();
    // Non-http images are dropped, but the role itself still identifies the character.
    expect(selectTvdbCharacter(["Ron"], [{ id: 3, name: "Ron", image: "javascript:x" }])).toEqual({
      id: "3",
      image: null,
    });
  });
});

describe("resolveCharacterImage", () => {
  const make = (
    source: CharacterImageResolver["source"],
    result: "hit" | "miss" | "fail",
  ): CharacterImageResolver & { resolve: ReturnType<typeof vi.fn> } => ({
    source,
    resolve: vi.fn(async () => {
      if (result === "fail") throw new Error("outage");
      return result === "hit" ? { src: `https://x/${source}.jpg` } : null;
    }),
  });

  it("returns the first source and does not query later ones", async () => {
    const [tvdb, wiki, db] = [
      make("tvdb", "hit"),
      make("wikimedia", "hit"),
      make("dubbingbase", "hit"),
    ];
    await expect(resolveCharacterImage([tvdb, wiki, db], new Set())).resolves.toMatchObject({
      source: "tvdb",
    });
    expect(wiki.resolve).not.toHaveBeenCalled();
    expect(db.resolve).not.toHaveBeenCalled();
  });

  it("falls through misses and outages in TVDB → Wikimedia → DubbingBase order", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const order: string[] = [];
    const track = (r: ReturnType<typeof make>) => {
      const inner = r.resolve;
      r.resolve = vi.fn(async () => (order.push(r.source), inner()));
      return r;
    };
    const resolvers = [
      track(make("tvdb", "fail")),
      track(make("wikimedia", "miss")),
      track(make("dubbingbase", "hit")),
    ];
    await expect(resolveCharacterImage(resolvers, new Set())).resolves.toMatchObject({
      source: "dubbingbase",
    });
    expect(order).toEqual(["tvdb", "wikimedia", "dubbingbase"]);
  });

  it("skips sources whose image failed to load and ends in null (placeholder)", async () => {
    const wiki = make("wikimedia", "hit");
    await expect(
      resolveCharacterImage([make("tvdb", "hit"), wiki], new Set(["tvdb"])),
    ).resolves.toMatchObject({ source: "wikimedia" });
    await expect(
      resolveCharacterImage([make("tvdb", "hit"), make("wikimedia", "miss")], new Set(["tvdb"])),
    ).resolves.toBeNull();
  });
});
