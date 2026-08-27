import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getWorkVotes } from "../../utils/db/queries";
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

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const user = event.context.user;

  const cache = useCache();
  const cacheKey = CACHE_KEYS.APP_VOICE_ACTOR(
    voiceActorId,
    acceptLanguage || "fr",
  );

  const cached = await cache.get(cacheKey);
  let baseData: any = cached;

  if (!baseData) {
    try {
      const tmdbClient = useTmdbClient();
      const mediaService = new MediaService(tmdbClient, acceptLanguage);
      baseData = await mediaService.getVoiceActorWithWorkAndMedia(voiceActorId);
      await cache.set(cacheKey, baseData, "SHORT");
    } catch (error) {
      console.error("Error fetching voice actor:", error);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch voice actor data",
      });
    }
  }

  if (user) {
    const workItems = (baseData?.voiceActor as any)?.work || [];
    const workIds = workItems.map((w: any) => w.id);
    if (workIds.length > 0) {
      try {
        const userVotes = await getWorkVotes(workIds, user.id);
        return {
          ...baseData,
          votes: userVotes,
        };
      } catch (err) {
        console.error(
          "Error fetching user-specific votes for voice actor:",
          err,
        );
      }
    }
  }

  return baseData;
});
