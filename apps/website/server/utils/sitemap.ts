import { APP_LOCALES, DEFAULT_LOCALE } from "@app/shared-logic";
import { SitemapIndexStream, SitemapStream, streamToPromise } from "sitemap";

/**
 * Records per child sitemap. Each record expands to one <url> per locale, so a chunk holds
 * SITEMAP_CHUNK_SIZE × locales entries; this stays far below the 50,000-URL / 50 MB protocol
 * limits and keeps each request's serialization CPU bounded.
 */
export const SITEMAP_CHUNK_SIZE = 2000;

/** Public, indexable static routes. Authenticated, admin and edit routes are intentionally absent. */
export const STATIC_SITEMAP_ROUTES = [
  "/",
  "/about",
  "/contribute",
  "/guidelines",
  "/legal",
  "/movies",
  "/privacy",
  "/series",
  "/studios",
  "/terms",
  "/terms-api",
  "/voice-actors",
] as const;

export interface SitemapEntity {
  /** Child sitemap name, e.g. `movies` serves `/sitemaps/movies-1.xml`. */
  name: string;
  /** Public page path prefix, e.g. `/movie` for `/movie/<id>`. */
  pathPrefix: string;
}

export const SITEMAP_ENTITIES = [
  { name: "movies", pathPrefix: "/movie" },
  { name: "shows", pathPrefix: "/show" },
  { name: "games", pathPrefix: "/game" },
  { name: "voice-actors", pathPrefix: "/voice-actor" },
  { name: "studios", pathPrefix: "/studio" },
] as const satisfies readonly SitemapEntity[];

export interface SitemapRecord {
  /** Route path without locale prefix, e.g. `/movie/603`. */
  path: string;
  /** ISO timestamp of the last meaningful change, when known. */
  lastmod?: string | null;
}

export function localizedPath(localeCode: string, path: string): string {
  if (localeCode === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${localeCode}` : `/${localeCode}${path}`;
}

function normalizeLastmod(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * One <url> per locale, each carrying the full hreflang alternate set plus x-default,
 * as recommended by Google for localized sites. XML serialization and escaping are
 * delegated to the `sitemap` library.
 */
export async function renderUrlset(
  origin: string,
  records: readonly SitemapRecord[],
): Promise<string> {
  const stream = new SitemapStream({
    hostname: origin,
    xmlns: { news: false, video: false, image: false, xhtml: true },
  });
  for (const record of records) {
    const lastmod = normalizeLastmod(record.lastmod);
    const links = [
      ...APP_LOCALES.map(({ code, language }) => ({
        lang: language,
        url: localizedPath(code, record.path),
      })),
      { lang: "x-default", url: localizedPath(DEFAULT_LOCALE, record.path) },
    ];
    for (const { code } of APP_LOCALES) {
      stream.write({ url: localizedPath(code, record.path), lastmod, links });
    }
  }
  stream.end();
  return new TextDecoder().decode(await streamToPromise(stream));
}

export async function renderSitemapIndex(
  origin: string,
  sitemaps: readonly { path: string; lastmod?: string | null }[],
): Promise<string> {
  const stream = new SitemapIndexStream({});
  for (const { path, lastmod } of sitemaps) {
    stream.write({ url: origin + path, lastmod: normalizeLastmod(lastmod) });
  }
  stream.end();
  return new TextDecoder().decode(await streamToPromise(stream));
}

/** Number of child sitemaps needed for a record total. */
export function chunkCount(totalRecords: number): number {
  return Math.ceil(totalRecords / SITEMAP_CHUNK_SIZE);
}
