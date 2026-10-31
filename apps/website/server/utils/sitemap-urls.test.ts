import { describe, expect, it } from "vitest";
import { buildSitemapUrls } from "./sitemap-urls";

describe("buildSitemapUrls", () => {
  it("includes public content routes in every locale without query variants", () => {
    expect(
      buildSitemapUrls(
        [
          {
            content_id: 85,
            content_type: "movie",
            updated_at: "2026-10-01T00:00:00Z",
          },
          { content_id: 1396, content_type: "tv", updated_at: null },
          { content_id: 1942, content_type: "video_game", updated_at: null },
          { content_id: -10, content_type: "toy", updated_at: null },
          { content_id: -20, content_type: "advertisement", updated_at: null },
          { content_id: 999, content_type: "unsupported", updated_at: null },
          { content_id: 0, content_type: "movie", updated_at: null },
        ],
        [{ id: 55, updated_at: null }],
        [{ id: 88, updated_at: null }],
        [{ content_id: -10, updated_at: null }],
      ),
    ).toEqual([
      {
        loc: "/movie/85",
        lastmod: "2026-10-01T00:00:00.000Z",
        _i18nTransform: true,
      },
      { loc: "/show/1396", _i18nTransform: true },
      { loc: "/game/1942", _i18nTransform: true },
      { loc: "/advertisement/-20", _i18nTransform: true },
      { loc: "/toy/-10", _i18nTransform: true },
      { loc: "/actor/55", _i18nTransform: true },
      { loc: "/voice-actor/88", _i18nTransform: true },
    ]);
  });

  it("includes toys only when metadata exists", () => {
    const urls = buildSitemapUrls(
      [
        { content_id: -10, content_type: "toy", updated_at: null },
        { content_id: -11, content_type: "toy", updated_at: null },
      ],
      [],
      [],
      [{ content_id: -10, updated_at: null }],
    );

    expect(urls.map(({ loc }) => loc)).toEqual(["/toy/-10"]);
  });

  it("keeps the newest modification date for duplicate media projects", () => {
    const urls = buildSitemapUrls(
      [
        {
          content_id: 85,
          content_type: "movie",
          updated_at: "2026-10-01T00:00:00Z",
        },
        {
          content_id: 85,
          content_type: "movie",
          updated_at: "2026-10-02T00:00:00Z",
        },
      ],
      [],
      [],
    );

    expect(urls).toEqual([
      {
        loc: "/movie/85",
        lastmod: "2026-10-02T00:00:00.000Z",
        _i18nTransform: true,
      },
    ]);
  });
});
