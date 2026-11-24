import { describe, expect, it } from "vitest";
import { apiMediaPath, mediaKey, segmentOf } from "./media";

describe("media addressing", () => {
  it("maps each public segment to its media kind and reference id", () => {
    expect(mediaKey("movies", 603)).toMatchObject({ contentType: "movie", contentId: 603 });
    expect(mediaKey("shows", 1399)).toMatchObject({ contentType: "tv", contentId: 1399 });
    expect(mediaKey("games", 7)).toMatchObject({ contentType: "video_game", contentId: 7 });
    expect(mediaKey("toys", 5)).toMatchObject({ contentType: "toy", contentId: 5 });
    expect(mediaKey("advertisements", 9)).toMatchObject({ contentId: 9 });
  });

  it("builds paths and maps kinds back to segments", () => {
    expect(apiMediaPath("toys", 5)).toBe("/api/v1/toys/5");
    expect(apiMediaPath("movies", 603)).toBe("/api/v1/movies/603");
    expect(segmentOf("video_game")).toBe("games");
    expect(segmentOf("tv")).toBe("shows");
    expect(segmentOf("seasons")).toBeNull();
  });
});
