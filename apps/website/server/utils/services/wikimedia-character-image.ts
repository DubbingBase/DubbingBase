import { isRecord, readPath, readProperty } from "@app/shared-logic";
import { createCacheNamespace } from "../cache";
import { buildCacheKey } from "../cache/constants";
import { useCache } from "../index";
import { withTimeout } from "../with-timeout";

const USER_AGENT = "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const REQUEST_TIMEOUT_MS = 2500;
// Wikidata properties: characters (of a work), present in work, image.
const CHARACTERS = "P674";
const PRESENT_IN_WORK = "P1441";
const IMAGE = "P18";
const FREE_LICENSE = /^(CC0|CC[ -]BY(?:[ -]SA)?[ -]\d|Public domain|PD[ -])/i;

export type WikimediaCharacterImage = {
  src: string;
  attribution: string;
  sourceUrl: string;
};

export const WIKIMEDIA_CHARACTER_IMAGE_NAMESPACE = createCacheNamespace<
  WikimediaCharacterImage | { miss: true }
>();

function normalizedName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function claimEntityIds(entity: unknown, property: string): string[] {
  const claims = readPath(entity, "claims", property);
  if (!Array.isArray(claims)) return [];
  return claims.flatMap((claim) => {
    const id = readPath(claim, "mainsnak", "datavalue", "value", "id");
    return typeof id === "string" ? [id] : [];
  });
}

function claimStrings(entity: unknown, property: string): string[] {
  const claims = readPath(entity, "claims", property);
  if (!Array.isArray(claims)) return [];
  return claims.flatMap((claim) => {
    const value = readPath(claim, "mainsnak", "datavalue", "value");
    return typeof value === "string" ? [value] : [];
  });
}

async function getJson(url: string): Promise<unknown> {
  const response = await withTimeout(
    fetch(url, { headers: { "User-Agent": USER_AGENT } }),
    REQUEST_TIMEOUT_MS,
    "Wikimedia",
  );
  if (!response.ok) throw new Error(`Wikimedia request failed with ${response.status}`);
  const body: unknown = await response.json();
  return body;
}

function wikidataEntities(ids: string[], props: string, languages?: string): Promise<unknown> {
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    ids: ids.join("|"),
    props,
  });
  if (languages) params.set("languages", languages);
  return getJson(`${WIKIDATA_API}?${params}`);
}

function stripHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => entities[name] ?? "")
    .trim();
}

/** Returns the file only when Commons reports a free license and attribution data. */
async function loadLicensedCommonsImage(fileName: string): Promise<WikimediaCharacterImage | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "500",
  });
  const data = await getJson(`${COMMONS_API}?${params}`);
  const pages = readPath(data, "query", "pages");
  const page = isRecord(pages) ? Object.values(pages)[0] : undefined;
  const info = readProperty(readProperty(page, "imageinfo"), "0");
  if (!isRecord(info)) return null;

  const metadata = readProperty(info, "extmetadata");
  const license = stripHtml(readPath(metadata, "LicenseShortName", "value"));
  const nonFree = readPath(metadata, "NonFree", "value");
  const restrictions = stripHtml(readPath(metadata, "Restrictions", "value"));
  const artist = stripHtml(readPath(metadata, "Artist", "value"));
  const src = readProperty(info, "thumburl") ?? readProperty(info, "url");
  const sourceUrl = readProperty(info, "descriptionurl");

  if (!FREE_LICENSE.test(license) || nonFree === "true" || restrictions) return null;
  if (!artist || typeof src !== "string" || typeof sourceUrl !== "string") return null;
  if (!src.startsWith("https://upload.wikimedia.org/")) return null;
  return { src, attribution: `${artist} · ${license}`, sourceUrl };
}

/**
 * Production-scoped lookup. The film's Wikidata item must list a character item
 * whose label equals the credited role AND whose only "present in work" value is
 * this film, i.e. an incarnation specific to this production. Generic characters
 * shared across films (e.g. Ron Weasley) are rejected rather than guessed.
 */
async function lookupWikimediaCharacterImage(
  wikidataId: string,
  characterName: string,
  language: string,
): Promise<WikimediaCharacterImage | null> {
  const film = readPath(await wikidataEntities([wikidataId], "claims"), "entities", wikidataId);
  const characterIds = [...new Set(claimEntityIds(film, CHARACTERS))].slice(0, 40);
  if (characterIds.length === 0) return null;

  const languages = [...new Set([language, "en"])].join("|");
  const entities = readProperty(
    await wikidataEntities(characterIds, "claims|labels", languages),
    "entities",
  );
  if (!isRecord(entities)) return null;

  const wanted = normalizedName(characterName);
  const matches = characterIds.flatMap((id) => {
    const entity = entities[id];
    const labels = readProperty(entity, "labels");
    const nameMatches =
      isRecord(labels) &&
      Object.values(labels).some((label) => {
        const value = readProperty(label, "value");
        return typeof value === "string" && normalizedName(value) === wanted;
      });
    const scopedToFilm = claimEntityIds(entity, PRESENT_IN_WORK).join() === wikidataId;
    const fileName = claimStrings(entity, IMAGE)[0];
    return nameMatches && scopedToFilm && fileName ? [fileName] : [];
  });
  // Several same-name candidates are ambiguous.
  const [fileName] = matches;
  if (matches.length !== 1 || !fileName) return null;
  return loadLicensedCommonsImage(fileName);
}

export async function getWikimediaCharacterImage(input: {
  contentType: "movie" | "tv";
  contentId: number;
  wikidataId: string;
  characterName: string;
  language: string;
}): Promise<WikimediaCharacterImage | null> {
  if (!/^Q\d+$/.test(input.wikidataId) || !input.characterName.trim()) return null;
  try {
    // Verified misses are cached too so films without an image are not re-queried;
    // provider failures throw and stay uncached.
    const cached = await useCache().getOrFetch(
      WIKIMEDIA_CHARACTER_IMAGE_NAMESPACE,
      buildCacheKey({
        provider: "wikimedia",
        resource: "production-character-image",
        id: input.contentId,
        language: input.language,
        params: { contentType: input.contentType, character: normalizedName(input.characterName) },
      }),
      async () =>
        (await lookupWikimediaCharacterImage(
          input.wikidataId,
          input.characterName,
          input.language,
        )) ?? { miss: true },
      { cachePolicy: "persistent", ttl: "STABLE" },
    );
    return "miss" in cached ? null : cached;
  } catch {
    return null;
  }
}
