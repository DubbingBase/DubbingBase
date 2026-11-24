import { describe, expect, it } from "vitest";
import {
  MEDIA_EMBED,
  MEDIA_FILTER_EMBED,
  MEDIA_KINDS,
  isMediaKind,
  mediaRefFilters,
  mediaRefFromEmbed,
} from "@app/shared-logic";

// packages/shared-logic has no test runner, so its media-ref tests live with the website's other
// `@app/shared-logic` tests.
describe("media-ref embeds", () => {
  it("exposes the left-join embed and the inner-join embed used for filtering", () => {
    expect(MEDIA_EMBED).toBe("media:media_id(id,kind,content_id)");
    expect(MEDIA_FILTER_EMBED).toBe("media:media_id!inner(id,kind,content_id)");
    expect(MEDIA_FILTER_EMBED).toContain("!inner");
    expect(MEDIA_EMBED).not.toContain("!inner");
  });

  it("lists every media kind", () => {
    expect([...MEDIA_KINDS].toSorted()).toEqual(
      ["advertisement", "audiobook", "movie", "podcast", "toy", "tv", "video_game"].toSorted(),
    );
  });
});

describe("isMediaKind", () => {
  it("accepts every known kind", () => {
    for (const kind of MEDIA_KINDS) expect(isMediaKind(kind)).toBe(true);
  });

  it("rejects unknown strings and non-strings", () => {
    for (const value of ["", "Movie", "game", "media", 1, null, undefined, {}, ["movie"]]) {
      expect(isMediaKind(value)).toBe(false);
    }
  });
});

describe("mediaRefFromEmbed", () => {
  it("converts a valid embed to a reference", () => {
    expect(mediaRefFromEmbed({ id: 7, kind: "tv", content_id: 1399 })).toEqual({
      mediaId: 7,
      contentType: "tv",
      contentId: 1399,
    });
  });

  it("keeps media.id as content id for toys", () => {
    expect(mediaRefFromEmbed({ id: 12, kind: "toy", content_id: 12 })).toEqual({
      mediaId: 12,
      contentType: "toy",
      contentId: 12,
    });
  });

  it("returns null for an unknown kind", () => {
    expect(mediaRefFromEmbed({ id: 1, kind: "book", content_id: 2 })).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(mediaRefFromEmbed(null)).toBeNull();
    expect(mediaRefFromEmbed(undefined)).toBeNull();
  });
});

describe("mediaRefFilters", () => {
  it("filters on the embedded media kind then content_id", () => {
    expect(mediaRefFilters("movie", 603)).toEqual([
      ["media.kind", "movie"],
      ["media.content_id", 603],
    ]);
    expect(mediaRefFilters("video_game", 5)).toEqual([
      ["media.kind", "video_game"],
      ["media.content_id", 5],
    ]);
  });
});
