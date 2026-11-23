import { useTmdbClient } from "../utils";
import { MediaService } from "../utils/services/media";
import { setNoCacheHeaders, setPublicCacheHeaders } from "../utils/cache/http";
import { withMediaServiceTimeout } from "../utils/media-request";
import { APP_LOCALES } from "@app/shared-logic";

/**
 * The TVDB cast of ONE production, with nothing that depends on which cards are
 * on screen. The URL is therefore identical for every visitor and every page of
 * cards, so the edge serves it for weeks; the browser matches role names itself
 * (`selectTvdbCharacter`).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const mediaType = query.mediaType;
  const mediaId = Number(query.mediaId);
  if (
    (mediaType !== "movie" && mediaType !== "tv") ||
    !Number.isSafeInteger(mediaId) ||
    mediaId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid production" });
  }
  const requestedLanguage = typeof query.lang === "string" ? query.lang.trim() : "";
  const language = APP_LOCALES.some((locale) => locale.language === requestedLanguage)
    ? requestedLanguage
    : "en-US";

  const mediaService = new MediaService(useTmdbClient(), language);
  // TMDB is only needed to find the TVDB id, so it is loaded on a cache miss only.
  const tvdb = await mediaService
    .getCharacterProfilePictures(
      mediaType,
      mediaId,
      async () =>
        (
          await withMediaServiceTimeout(
            () =>
              mediaService.getMediaWithVoiceActors(mediaType, mediaId, {
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
  const degraded = tvdb.degraded === true;

  const characters = tvdb.characters.flatMap((character) =>
    character.name
      ? [
          {
            id: String(character.id),
            name: character.name,
            image: /^https?:\/\//.test(character.image) ? character.image : null,
          },
        ]
      : [],
  );

  // Provider failures look like an empty cast; never let a CDN keep those.
  if (degraded) setNoCacheHeaders(event);
  else {
    setPublicCacheHeaders(
      event,
      characters.length > 0 ? "character-images" : "character-images-negative",
    );
  }
  return { tvdbId: tvdb.tvdbId, characters, degraded };
});
