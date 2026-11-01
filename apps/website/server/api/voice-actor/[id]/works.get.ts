import { useTmdbClient } from "../../../utils";
import { MediaService } from "../../../utils/services/media";
import { resolveVoiceActorLanguage } from "../../../utils/voice-actor-language";

const MAX_WORKS_PER_PAGE = 12;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id parameter" });

  const voiceActorId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(voiceActorId) || voiceActorId <= 0) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  const query = getQuery(event);
  const rawIds = typeof query.ids === "string" ? query.ids.split(",") : [];
  const workIds = rawIds.map((value) => (/^[1-9]\d*$/.test(value) ? Number(value) : NaN));
  if (
    workIds.length === 0 ||
    workIds.length > MAX_WORKS_PER_PAGE ||
    workIds.some((workId) => !Number.isSafeInteger(workId) || workId <= 0) ||
    new Set(workIds).size !== workIds.length
  ) {
    throw createError({ statusCode: 400, message: "Invalid work ids" });
  }

  try {
    const language = resolveVoiceActorLanguage(event);
    const mediaService = new MediaService(useTmdbClient(), language);
    const result = await mediaService.getVoiceActorWithWorkAndMedia(voiceActorId, language, {
      includePotentialWikipediaUrl: false,
      includeBackdrop: false,
      workIds,
      pageMediaCacheSignature:
        typeof query.cacheSignature === "string" && /^[0-9a-z]{1,13}$/.test(query.cacheSignature)
          ? query.cacheSignature
          : undefined,
    });

    const existingWorkIds = new Set(result.voiceActor.work.map((work: { id: number }) => work.id));
    const removedWorkIds = workIds.filter((workId) => !existingWorkIds.has(workId));
    if (removedWorkIds.length > 0) {
      return { enhancedWorks: [], removedWorkIds };
    }

    const enhancedWorkIds = new Set(result.enhancedWorks.map((work) => work.work.id));
    if (workIds.some((workId) => !enhancedWorkIds.has(workId))) {
      throw createError({
        statusCode: 502,
        message: "Failed to load all requested voice actor works",
      });
    }

    return { enhancedWorks: result.enhancedWorks, removedWorkIds: [] };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Error fetching voice actor works:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch voice actor works",
    });
  }
});
