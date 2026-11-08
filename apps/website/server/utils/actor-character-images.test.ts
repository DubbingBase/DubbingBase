import { describe, expect, it, vi } from "vitest";
import {
  getCreditedCharacter,
  resolveCharacterImage,
  selectTvdbCharacterImage,
  type CharacterImageResolver,
} from "./actor-character-images";

describe("getCreditedCharacter", () => {
  const credits = {
    cast: [
      { id: 671, character: "Ron Weasley" },
      { id: 672, character: "Ron Weasley (voice)" },
      { id: 700, character: "A" },
      { id: 700, character: "B" },
    ],
  };

  it("returns the cleaned role credited in that production only", () => {
    expect(getCreditedCharacter(credits, 671)).toBe("Ron Weasley");
    expect(getCreditedCharacter(credits, 672)).toBe("Ron Weasley");
    expect(getCreditedCharacter(credits, 999)).toBeNull();
  });

  it("is conservative when one production has several roles", () => {
    expect(getCreditedCharacter(credits, 700)).toBeNull();
  });
});

describe("selectTvdbCharacterImage", () => {
  const movie671 = [
    { name: "Ron Weasley", image: "https://artworks.thetvdb.com/ron-2001.jpg" },
    { name: "Harry Potter", image: "https://artworks.thetvdb.com/harry.jpg" },
  ];
  const movie672 = [{ name: "Ron Weasley", image: "https://artworks.thetvdb.com/ron-2002.jpg" }];

  it("resolves the two Ron Weasley movies separately from their own production", () => {
    expect(selectTvdbCharacterImage("Ron Weasley", movie671)).toBe(
      "https://artworks.thetvdb.com/ron-2001.jpg",
    );
    expect(selectTvdbCharacterImage("ron weasley", movie672)).toBe(
      "https://artworks.thetvdb.com/ron-2002.jpg",
    );
  });

  it("rejects ambiguous, missing and non-http matches", () => {
    expect(selectTvdbCharacterImage("Ron Weasley", [...movie671, ...movie672])).toBeNull();
    expect(selectTvdbCharacterImage("Hermione", movie671)).toBeNull();
    expect(selectTvdbCharacterImage("Ron", [{ name: "Ron", image: "javascript:x" }])).toBeNull();
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
