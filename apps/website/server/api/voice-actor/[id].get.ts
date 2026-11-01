import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { resolveVoiceActorLanguage } from "../../utils/voice-actor-language";
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const voiceActorId = parseInt(id, 10);
  if (isNaN(voiceActorId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }
  const query = getQuery(event);
  const pageProjection = query.projection === "page";
  // TMDB language follows the route locale (?lang=), not the ambient browser
  // header, so titles match the page language and cache keys stay collapsed.
  const acceptLanguage = resolveVoiceActorLanguage(event);
  try {
    const tmdbClient = useTmdbClient();
    const mediaService = new MediaService(tmdbClient, acceptLanguage);
    const baseData = await mediaService.getVoiceActorWithWorkAndMedia(
      voiceActorId,
      acceptLanguage,
      {
        includePotentialWikipediaUrl: !pageProjection,
        includePageMediaCacheSignature: pageProjection,
      },
    );
    if (!pageProjection) return baseData;

    const pageSize = 12;
    const requestedPage = Number.parseInt(String(query.page ?? "1"), 10);
    const pageCount = Math.max(1, Math.ceil(baseData.enhancedWorks.length / pageSize));
    const page = Math.min(
      Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
      pageCount,
    );
    const sortedWorks = baseData.enhancedWorks
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const dateOrder = left.item.sortDate.localeCompare(right.item.sortDate);
        return dateOrder === 0 ? left.index - right.index : -dateOrder;
      })
      .map(({ item }) => item);
    const pageWorks = sortedWorks.slice((page - 1) * pageSize, page * pageSize);
    const pageMediaKeys = new Set(pageWorks.map(({ media }) => `${media.media_type}:${media.id}`));
    const workIndex = baseData.enhancedWorks.map(({ work, data, sortDate, searchText }) => ({
      work: {
        id: work.id,
        actor_id: work.actor_id,
        performance: work.performance,
        dubbing_projects: work.dubbing_projects
          ? {
              content_type: work.dubbing_projects.content_type,
              studios: work.dubbing_projects.studios,
            }
          : null,
      },
      data: {
        character: data.character,
        actor: {
          id: data.actor.id,
          name: data.actor.name,
          profile_picture: data.actor.profile_picture,
        },
      },
      sortDate,
      searchText,
    }));

    return {
      workCount: baseData.voiceActor.work.length,
      voiceActor: { ...baseData.voiceActor, work: [] },
      enhancedWorks: pageWorks.map(({ media, ...work }) => ({
        ...work,
        media_id: media.id,
        media_type: media.media_type,
      })),
      workIndex,
      pageMediaCacheSignature: baseData.pageMediaCacheSignature ?? null,
      medias: baseData.medias.filter((media) =>
        pageMediaKeys.has(`${media.media_type}:${media.id}`),
      ),
      characterProfilePictures: baseData.characterProfilePictures,
      potentialWikipediaUrl: baseData.potentialWikipediaUrl,
      backdropPath: baseData.backdropPath,
    };
  } catch (error) {
    console.error("Error fetching voice actor:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch voice actor data",
    });
  }
});
