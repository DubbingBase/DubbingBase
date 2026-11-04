import { describe, expect, it } from "vitest";
import {
  SITEMAP_CHUNK_SIZE,
  chunkCount,
  localizedPath,
  renderSitemapIndex,
  renderUrlset,
} from "./sitemap";

const origin = "https://example.test";

describe("localizedPath", () => {
  it("keeps the default locale unprefixed and prefixes others", () => {
    expect(localizedPath("en", "/movie/1")).toBe("/movie/1");
    expect(localizedPath("fr", "/movie/1")).toBe("/fr/movie/1");
    expect(localizedPath("ja", "/")).toBe("/ja");
  });
});

describe("renderUrlset", () => {
  it("emits one url per locale with full hreflang alternates, x-default and lastmod", async () => {
    const xml = await renderUrlset(origin, [
      { path: "/movie/603", lastmod: "2026-01-02T03:04:05Z" },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(4);
    expect(xml).toContain("<loc>https://example.test/movie/603</loc>");
    expect(xml).toContain("<loc>https://example.test/fr/movie/603</loc>");
    expect(xml).toContain('hreflang="ja-JP" href="https://example.test/ja/movie/603"');
    expect(xml).toContain('hreflang="x-default" href="https://example.test/movie/603"');
    expect(xml).toContain("<lastmod>2026-01-02T03:04:05.000Z</lastmod>");
  });

  it("omits invalid lastmod and escapes XML", async () => {
    const xml = await renderUrlset(origin, [{ path: "/a&b", lastmod: "not a date" }]);
    expect(xml).not.toContain("<lastmod>");
    expect(xml).toContain("/a&amp;b");
  });
});

describe("renderSitemapIndex / chunkCount", () => {
  it("lists child sitemaps", async () => {
    const xml = await renderSitemapIndex(origin, [{ path: "/sitemaps/movies-1.xml" }]);
    expect(xml).toContain(
      "<sitemap><loc>https://example.test/sitemaps/movies-1.xml</loc></sitemap>",
    );
  });

  it("computes chunk counts", () => {
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(1)).toBe(1);
    expect(chunkCount(SITEMAP_CHUNK_SIZE + 1)).toBe(2);
  });
});
