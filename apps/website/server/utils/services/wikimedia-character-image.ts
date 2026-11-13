import { isRecord, readPath, readProperty } from "@app/shared-logic";
import { withTimeout } from "../with-timeout";
import { buildCacheKey } from "../cache/constants";
import { createCacheNamespace, type SimpleCache } from "../cache";
import { CHARACTER_IMAGE_POSITIVE_TTL } from "../character-images";

// Provider answers are slow-moving; empty/negative outcomes expire sooner so
// new Wikidata or Commons data is picked up within a day.
const NEGATIVE_TTL = 24 * 60 * 60;
const productionsNamespace = createCacheNamespace<ProductionCharacter[]>();
// KV does not store `null`, so a "no free image" outcome is wrapped.
const filesNamespace = createCacheNamespace<{ image: WikimediaCharacterImage | null }>();

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

type CharacterImageLookup = {
  contentType: "movie" | "tv";
  contentId: number;
  wikidataId: string;
  characterName: string;
  language: string;
};

type ProductionCharacter = { names: string[]; fileName: string };
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
  if (readProperty(body, "error")) throw new Error("Wikimedia API error");
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
  if (!isRecord(pages)) throw new Error("Invalid Commons response");
  const page = Object.values(pages)[0];
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
async function loadProductionCharacters(
  wikidataId: string,
  language: string,
): Promise<ProductionCharacter[]> {
  const film = readPath(await wikidataEntities([wikidataId], "claims"), "entities", wikidataId);
  if (!isRecord(film)) throw new Error("Invalid Wikidata work response");
  const characterIds = [...new Set(claimEntityIds(film, CHARACTERS))].slice(0, 40);
  if (characterIds.length === 0) return [];

  const languages = [...new Set([language, "en"])].join("|");
  const entities = readProperty(
    await wikidataEntities(characterIds, "claims|labels", languages),
    "entities",
  );
  if (!isRecord(entities)) throw new Error("Invalid Wikidata character response");

  // A merged or deleted character item comes back as `{ missing: "" }`; that is
  // a permanent property of the data, not a provider failure, so skip it.
  return characterIds.flatMap((id) => {
    const entity = entities[id];
    if (!isRecord(entity) || "missing" in entity) return [];
    const labels = readProperty(entity, "labels");
    const names = isRecord(labels)
      ? Object.values(labels).flatMap((label) => {
          const value = readProperty(label, "value");
          return typeof value === "string" ? [normalizedName(value)] : [];
        })
      : [];
    const scopedToFilm = claimEntityIds(entity, PRESENT_IN_WORK).join() === wikidataId;
    const fileName = claimStrings(entity, IMAGE)[0];
    return scopedToFilm && fileName && names.length ? [{ names, fileName }] : [];
  });
}

/** Create once per API request; share provider work only for that request's cards. */
export function createWikimediaCharacterImageResolver(
  cache?: SimpleCache,
): (input: CharacterImageLookup) => Promise<WikimediaCharacterImage | null> {
  const productions = new Map<string, Promise<ProductionCharacter[]>>();
  const files = new Map<string, Promise<WikimediaCharacterImage | null>>();

  return async (input) => {
    if (!/^Q\d+$/.test(input.wikidataId) || !input.characterName.trim()) return null;
    const key = JSON.stringify([
      input.contentType,
      input.contentId,
      input.wikidataId,
      input.language,
    ]);
    let characters = productions.get(key);
    if (!characters) {
      const load = () => loadProductionCharacters(input.wikidataId, input.language);
      if (cache) {
        const productionKey = buildCacheKey({
          provider: "wikimedia",
          resource: "production-characters",
          id: input.wikidataId,
          language: input.language,
        });
        // Only verified provider answers are persisted (failures throw past the set).
        characters = cache.getOrFetch(
          productionsNamespace,
          productionKey,
          async () => {
            const value = await load();
            await cache.set(
              productionKey,
              value,
              value.length ? CHARACTER_IMAGE_POSITIVE_TTL : NEGATIVE_TTL,
            );
            return value;
          },
          { cachePolicy: "read-only" },
        );
      } else {
        characters = load();
      }
      productions.set(key, characters);
    }
    const wanted = normalizedName(input.characterName);
    const matches = (await characters)
      .filter((character) => character.names.includes(wanted))
      .map((character) => character.fileName);
    // Several same-name candidates are ambiguous.
    const [fileName] = matches;
    if (matches.length !== 1 || !fileName) return null;

    let image = files.get(fileName);
    if (!image) {
      const load = () => loadLicensedCommonsImage(fileName);
      if (cache) {
        const fileKey = buildCacheKey({
          provider: "wikimedia",
          resource: "commons-image",
          query: fileName,
        });
        image = cache
          .getOrFetch(
            filesNamespace,
            fileKey,
            async () => {
              const value = { image: await load() };
              await cache.set(
                fileKey,
                value,
                value.image ? CHARACTER_IMAGE_POSITIVE_TTL : NEGATIVE_TTL,
              );
              return value;
            },
            { cachePolicy: "read-only" },
          )
          .then((value) => value.image);
      } else {
        image = load();
      }
      files.set(fileName, image);
    }
    return image;
  };
}
