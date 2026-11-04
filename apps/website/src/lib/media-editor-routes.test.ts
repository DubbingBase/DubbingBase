import { describe, expect, it } from "vitest";
import { getMediaEditorRoute } from "./media-editor-routes";

describe("getMediaEditorRoute", () => {
  it.each([
    ["movie", "/movie/42/projects/7/edit"],
    ["tv", "/show/42/projects/7/edit"],
    ["video_game", "/game/42/projects/7/edit"],
    ["audiobook", "/audiobook/42/projects/7/edit"],
    ["podcast", "/podcast/42/projects/7/edit"],
    ["advertisement", "/advertisement/42/projects/7/edit"],
    ["toy", "/toy/42/projects/7/edit"],
  ])("builds an edit route for %s", (contentType, expected) => {
    expect(getMediaEditorRoute({ contentType, mediaId: 42, projectId: 7 })).toBe(expected);
  });

  it.each(["movie", "tv", "video_game", "audiobook"])(
    "rejects direct creation for %s",
    (contentType) => {
      expect(getMediaEditorRoute({ contentType })).toBeNull();
    },
  );

  it("builds a project creation route for known media", () => {
    expect(getMediaEditorRoute({ contentType: "tv", mediaId: 42 })).toBe("/show/42/projects/new");
  });

  it.each(["show", "serie", "game", "season", "episode", "unknown", undefined])(
    "rejects non-editor content type %s",
    (contentType) => {
      expect(getMediaEditorRoute({ contentType })).toBeNull();
    },
  );

  it("rejects an invalid project id", () => {
    expect(getMediaEditorRoute({ contentType: "movie", mediaId: 42, projectId: 0 })).toBeNull();
  });

  it("rejects a project without its media id", () => {
    expect(getMediaEditorRoute({ contentType: "movie", projectId: 7 })).toBeNull();
  });
});
