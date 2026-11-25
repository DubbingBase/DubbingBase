import type { H3Event } from "h3";
import { useTmdbClient } from "../utils";
import { MediaService } from "../utils/services/media";
import { setNoCacheHeaders, setPublicCacheHeaders } from "../utils/cache/http";
import { withMediaServiceTimeout } from "../utils/media-request";
import { APP_LOCALES } from "@app/shared-logic";
import {
  CHARACTER_PORTRAIT_BATCH_LIMIT,
  type CharacterRoster,
  type CharacterRosterBatch,
} from "../../shared/character-portraits";

type Production = { key: string; mediaType: "movie" | "tv"; mediaId: number };

function parseProductions(value: unknown): Production[] | null {
  if (typeof value !== "string") return null;
  const keys = value.split(",");
  if (keys.length < 2 || keys.length > CHARACTER_PORTRAIT_BATCH_LIMIT) return null;
  const productions: Production[] = [];
  for (const key of keys) {
    const match = /^(movie|tv):([1-9]\d*)$/.exec(key);
    if (!match || match[0] !== key) return null;
    const mediaId = Number(match[2]);
    if (!Number.isSafeInteger(mediaId)) return null;
    productions.push({ key, mediaType: match[1] === "movie" ? "movie" : "tv", mediaId });
  }
  const canonical = productions.map(({ key }) => key).sort();
  if (
    new Set(canonical).size !== keys.length ||
    canonical.some((key, index) => key !== keys[index])
  )
    return null;
  return productions;
}

async function loadRoster(
  service: MediaService,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<CharacterRoster> {
  // TMDB is only needed when the cached TVDB roster is unavailable.
  const tvdb = await service
    .getCharacterProfilePictures(
      mediaType,
      mediaId,
      async () =>
        (
          await withMediaServiceTimeout(
            () =>
              service.getMediaWithVoiceActors(mediaType, mediaId, {
                includeCollection: false,
                includeCreditsCrew: false,
                projection: "media-page",
              }),
            `TMDB ${mediaType}`,
          )
        ).media,
    )
    .catch((error) => {
      console.error("Character portraits TVDB lookup failed:", error);
      return { characters: [], tvdbId: null, degraded: true };
    });
  return {
    tvdbId: tvdb.tvdbId,
    characters: tvdb.characters.flatMap((character) =>
      character.name
        ? [
            {
              id: String(character.id),
              name: character.name,
              image: /^https?:\/\//.test(character.image) ? character.image : null,
            },
          ]
        : [],
    ),
    degraded: tvdb.degraded === true,
  };
}

function setRosterCacheHeaders(event: H3Event, rosters: CharacterRoster[]): void {
  if (rosters.some((roster) => roster.degraded)) {
    setNoCacheHeaders(event);
    return;
  }
  setPublicCacheHeaders(
    event,
    rosters.every((roster) => roster.characters.length > 0)
      ? "character-images"
      : "character-images-negative",
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const requestedLanguage = typeof query.lang === "string" ? query.lang.trim() : "";
  const language = APP_LOCALES.some((locale) => locale.language === requestedLanguage)
    ? requestedLanguage
    : "en-US";

  if (query.productions !== undefined) {
    const batch = parseProductions(query.productions);
    if (!batch) throw createError({ statusCode: 400, statusMessage: "Invalid productions" });

    const service = new MediaService(useTmdbClient(), language);
    const entries = await Promise.all(
      batch.map(async ({ key, mediaType, mediaId }): Promise<[string, CharacterRoster]> => [
        key,
        await loadRoster(service, mediaType, mediaId),
      ]),
    );
    const rosters: CharacterRosterBatch = Object.fromEntries(entries);
    setRosterCacheHeaders(event, Object.values(rosters));
    return rosters;
  }

  const mediaType = query.mediaType;
  const mediaId = Number(query.mediaId);
  if (
    (mediaType !== "movie" && mediaType !== "tv") ||
    !Number.isSafeInteger(mediaId) ||
    mediaId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid production" });
  }

  const roster = await loadRoster(new MediaService(useTmdbClient(), language), mediaType, mediaId);
  setRosterCacheHeaders(event, [roster]);
  return roster;
});
