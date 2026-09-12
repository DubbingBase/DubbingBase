import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { CACHE_KEYS } from "../../utils/cache/constants";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const voiceActorId = parseInt(id, 10);
  if (isNaN(voiceActorId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }
  // Normalize to the primary tag: raw Accept-Language varies per browser
  // ("fr-FR,fr;q=0.9,...") and must not fragment the KV key. Default matches
  // TMDBClient ("fr-FR") so header-less SSR renders share the hot entries
  // instead of forking "fr" keys. Applies to every locale: en-US, fr-FR,
  // es-ES, ja-JP each collapse to one entry.
  const acceptLanguage =
    (getHeader(event, "accept-language") || "fr-FR").split(",")[0]?.trim() ||
    "fr-FR";

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
