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
  const expected = publicRoutes.map((route) => `${origin}${localizedPath(prefix, route)}`);
  if (locations.length !== expected.length || expected.some((url) => !locations.includes(url))) {
    throw new Error(`The ${code} sitemap does not match the public-route allow-list.`);
  }

  for (const { code: alternateCode, prefix: alternatePrefix } of locales) {
    if (!xml.includes(`hreflang="${alternateCode}"`)) {
      throw new Error(`The ${code} sitemap is missing the ${alternateCode} alternate links.`);
    }
    for (const route of publicRoutes) {
      const alternateUrl = `${origin}${localizedPath(alternatePrefix, route)}`;
      if (!xml.includes(`href="${alternateUrl}"`)) {
        throw new Error(`The ${code} sitemap is missing alternate URL ${alternateUrl}.`);
      }
    }
  }

  if (!xml.includes('hreflang="x-default"')) {
    throw new Error(`The ${code} sitemap is missing its x-default alternate links.`);
  }
}

const sitemapAlias = await readFile(resolve(publicDirectory, "sitemap.xml"), "utf8");
if (sitemapAlias !== index) {
  throw new Error("sitemap.xml must be an exact copy of sitemap_index.xml.");
}

const robots = await readFile(resolve(import.meta.dirname, "../public/_robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) {
  throw new Error("The robots.txt source does not reference the root sitemap alias.");
}
