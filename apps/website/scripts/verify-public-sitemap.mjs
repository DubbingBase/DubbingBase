import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDirectory = resolve(import.meta.dirname, "../.output/public");
const locales = [
  { code: "en-US", prefix: "" },
  { code: "fr-FR", prefix: "/fr" },
  { code: "es-ES", prefix: "/es" },
  { code: "ja-JP", prefix: "/ja" },
];
const publicRoutes = [
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
];

function localizedPath(prefix, route) {
  if (route === "/") return prefix || "/";
  return `${prefix}${route}`;
}

function readLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function readUrlEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, url]) => ({
    location: /<loc>([^<]+)<\/loc>/.exec(url)?.[1],
    alternates: Object.fromEntries(
      [...url.matchAll(/<xhtml:link\b[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?\s*>/g)].map(
        ([, language, href]) => [language, href],
      ),
    ),
  }));
}

const index = await readFile(resolve(publicDirectory, "sitemap_index.xml"), "utf8");
const sitemapUrls = readLocations(index);
if (sitemapUrls.length !== locales.length) {
  throw new Error(`Expected ${locales.length} sitemap shards; found ${sitemapUrls.length}.`);
}

const origin = new URL(sitemapUrls[0]).origin;
for (const { code, prefix } of locales) {
  const shardUrl = `${origin}/__sitemap__/${code}.xml`;
  if (!sitemapUrls.includes(shardUrl)) {
    throw new Error(`Sitemap index is missing ${shardUrl}.`);
  }

  const xml = await readFile(resolve(publicDirectory, `__sitemap__/${code}.xml`), "utf8");
  const locations = readLocations(xml);
  const entries = readUrlEntries(xml);
  const expected = publicRoutes.map((route) => `${origin}${localizedPath(prefix, route)}`);
  const routeByLocation = new Map(expected.map((location, index) => [location, publicRoutes[index]]));
  if (
    locations.length !== expected.length ||
    entries.length !== expected.length ||
    expected.some((url) => !locations.includes(url))
  ) {
    throw new Error(`The ${code} sitemap does not match the public-route allow-list.`);
  }

  for (const entry of entries) {
    const route = routeByLocation.get(entry.location);
    if (!route) throw new Error(`The ${code} sitemap contains an unexpected URL entry.`);

    for (const { code: alternateCode, prefix: alternatePrefix } of locales) {
      const alternateUrl = `${origin}${localizedPath(alternatePrefix, route)}`;
      if (entry.alternates[alternateCode] !== alternateUrl) {
        throw new Error(`The ${entry.location} entry has an incorrect ${alternateCode} alternate.`);
      }
    }
    const defaultUrl = `${origin}${localizedPath("", route)}`;
    if (entry.alternates["x-default"] !== defaultUrl) {
      throw new Error(`The ${entry.location} entry has an incorrect x-default alternate.`);
    }
  }
}

const sitemapAlias = await readFile(resolve(publicDirectory, "sitemap.xml"), "utf8");
if (sitemapAlias !== index) {
  throw new Error("sitemap.xml must be an exact copy of sitemap_index.xml.");
}

const robots = await readFile(resolve(import.meta.dirname, "../public/_robots.txt"), "utf8");
if (!robots.includes("User-agent: *") || !robots.includes("Allow: /")) {
  throw new Error("The robots.txt source must allow public crawling.");
}
if (robots.includes("Sitemap:")) {
  throw new Error("The sitemap directive must come from the configured robots sitemap URL.");
}

const generatedRobots = await readFile(resolve(publicDirectory, "robots.txt"), "utf8");
if (!generatedRobots.includes(`Sitemap: ${origin}/sitemap.xml`)) {
  throw new Error("The generated robots.txt does not reference the configured sitemap origin.");
}
