import { useTmdbClient } from "../utils";
import { MediaService } from "../utils/services/media";
import { getWikimediaCharacterImage } from "../utils/services/wikimedia-character-image";
import {
  isCharacterImageSource,
  resolveCharacterImage,
  selectTvdbCharacter,
  type CharacterImage,
  type CharacterImageSource,
} from "../utils/character-images";
import { setNoCacheHeaders, setPublicCacheHeaders } from "../utils/cache/http";
import { withMediaServiceTimeout } from "../utils/media-request";
import { APP_LOCALES, readPath } from "@app/shared-logic";

// One page of cards; never a whole filmography or cast.
const MAX_ITEMS = 24;
const CONCURRENCY = 4;
const NAME_SEPARATOR = "|";
// Keeps the URL and the number of provider lookups per card bounded.
const MAX_NAMES = 4;
const MAX_NAME_LENGTH = 80;

type Item = { raw: string; mediaType: "movie" | "tv"; mediaId: number; names: string[] };

/** `item=movie:671:Ron Weasley|Ron` — repeatable, one card each. */
function parseItems(value: unknown): Item[] {
  const rawItems = (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is string => typeof entry === "string",
  );
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const raw of rawItems) {
    const [mediaType, id, ...rest] = raw.split(":");
    const mediaId = Number(id);
    const names = rest
      .join(":")
      .split(NAME_SEPARATOR)
      .map((name) => name.trim().slice(0, MAX_NAME_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_NAMES);
    if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isSafeInteger(mediaId)) continue;
    if (mediaId < 1 || names.length === 0 || seen.has(raw)) continue;
    seen.add(raw);
    items.push({ raw, mediaType, mediaId, names });
  }
  return items.slice(0, MAX_ITEMS);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const items = parseItems(query.item);
  const skip = new Set<CharacterImageSource>(
    String(query.skip ?? "")
      .split(",")
      .filter(isCharacterImageSource),
  );
  const requestedLanguage = typeof query.lang === "string" ? query.lang.trim() : "";
  const language = APP_LOCALES.some((locale) => locale.language === requestedLanguage)
    ? requestedLanguage
    : "en-US";

  if (items.length === 0) {
    setPublicCacheHeaders(event, "detail-json");
    return { images: {}, characterIds: {}, tvdbIds: {} };
  }

  const mediaService = new MediaService(useTmdbClient(), language);
  const images: Record<string, CharacterImage | null> = {};
  const characterIds: Record<string, string> = {};
  const tvdbIds: Record<string, number> = {};
  let degraded = false;

  // One TMDB lookup, and at most one TVDB lookup, per production; the TVDB one is
  // skipped entirely when every card of that production already skipped TVDB.
  const medias = new Map<string, Promise<unknown>>();
  const tvdbLookups = new Map<string, ReturnType<typeof loadTvdb>>();
  function media(mediaType: "movie" | "tv", mediaId: number) {
    const key = `${mediaType}:${mediaId}`;
    let loaded = medias.get(key);
    if (!loaded) {
      loaded = withMediaServiceTimeout(
        async () =>
          (
            await mediaService.getMediaWithVoiceActors(mediaType, mediaId, {
              includeCollection: false,
              includeCreditsCrew: false,
              projection: "media-page",
            })
          ).media,
        `TMDB ${mediaType}`,
      );
      medias.set(key, loaded);
    }
    return loaded;
  }
  async function loadTvdb(mediaType: "movie" | "tv", mediaId: number) {
    const tvdb = await mediaService.getCharacterProfilePictures(
      mediaType,
      mediaId,
      await media(mediaType, mediaId),
    );
    if (tvdb.degraded) degraded = true;
    if (tvdb.tvdbId) tvdbIds[`${mediaType}:${mediaId}`] = tvdb.tvdbId;
    return tvdb.characters;
  }
  function tvdb(mediaType: "movie" | "tv", mediaId: number) {
    const key = `${mediaType}:${mediaId}`;
    let loaded = tvdbLookups.get(key);
    if (!loaded) {
      loaded = loadTvdb(mediaType, mediaId);
      tvdbLookups.set(key, loaded);
    }
    return loaded;
  }

  async function resolveItem({ raw, mediaType, mediaId, names }: Item) {
    images[raw] = await resolveCharacterImage(
      [
        {
          source: "tvdb",
          resolve: async () => {
            const characters = await tvdb(mediaType, mediaId);
            const match = selectTvdbCharacter(names, characters);
            if (match) characterIds[raw] = match.id;
            return match?.image ? { src: match.image } : null;
          },
        },
        {
          source: "wikimedia",
          resolve: async () => {
            const wikidataId = readPath(
              await media(mediaType, mediaId),
              "external_ids",
              "wikidata_id",
            );
            if (typeof wikidataId !== "string") return null;
            for (const characterName of names) {
              const image = await getWikimediaCharacterImage({
                contentType: mediaType,
                contentId: mediaId,
                wikidataId,
                characterName,
                language,
              });
              if (image) return image;
            }
            return null;
          },
        },
        // No curated DubbingBase character image exists for TMDB productions yet
        // (work rows only store the character name), so there is nothing to look up.
      ],
      skip,
      () => {
        degraded = true;
      },
    );
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        if (item) await resolveItem(item);
      }
    }),
  );

  // Provider failures look like "no image"; never let a CDN keep those results.
  if (degraded) setNoCacheHeaders(event);
  else setPublicCacheHeaders(event, "detail-json");
  return { images, characterIds, tvdbIds };
});
