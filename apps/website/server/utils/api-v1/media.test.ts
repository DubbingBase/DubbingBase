import { describe, expect, it } from "vitest";
import { apiMediaPath, deriveRequestId, mediaKey, segmentOf } from "./media";

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

describe("deriveRequestId", () => {
  const key = "7f0c6d1e-95b9-4f4c-8d0f-4e1c8a1b2c3d";

  it("is a stable UUID per key and position, and differs for another position or key", async () => {
    const first = await deriveRequestId(key, 0);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await deriveRequestId(key, 0)).toBe(first);
    expect(await deriveRequestId(key, 1)).not.toBe(first);
    expect(await deriveRequestId("0f0c6d1e-95b9-4f4c-8d0f-4e1c8a1b2c3d", 0)).not.toBe(first);
  });
});
