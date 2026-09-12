import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { CACHE_KEYS } from "../../utils/cache/constants";
import { APP_LOCALES } from "@app/shared-logic";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const voiceActorId = parseInt(id, 10);
  if (isNaN(voiceActorId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }
  // TMDB language follows the route locale (?lang=), not the ambient browser
  // header: titles must match the page language. Allowlisted to the 4
  // canonical tags so cache keys stay collapsed; header is the fallback.
  const query = getQuery(event);
  const rawLang = typeof query.lang === "string" ? query.lang.trim() : "";
  const canonicalLangs = APP_LOCALES.map((l) => l.language);
  const shortToCanonical: Record<string, string> = Object.fromEntries(
    APP_LOCALES.map((l) => [l.code, l.language]),
  );
  const headerLang =
    (getHeader(event, "accept-language") || "fr-FR").split(",")[0]?.trim() ||
    "fr-FR";
  const acceptLanguage = canonicalLangs.includes(rawLang)
    ? rawLang
    : shortToCanonical[rawLang] || headerLang;

  // Set HTTP Edge caching / SWR headers for optimal CDN performance
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const cache = useCache(event);
  const cacheKey = CACHE_KEYS.APP_VOICE_ACTOR(voiceActorId, acceptLanguage);

  const cached = await cache.get(cacheKey);
  let baseData: any = cached;

  if (!baseData) {
    try {
      const tmdbClient = useTmdbClient();
      const mediaService = new MediaService(tmdbClient, acceptLanguage);
      baseData = await mediaService.getVoiceActorWithWorkAndMedia(
        voiceActorId,
        acceptLanguage,
      );
      await cache.set(cacheKey, baseData, "SHORT");
    } catch (error) {
      console.error("Error fetching voice actor:", error);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch voice actor data",
      });
    }
  }

  return baseData;
});
