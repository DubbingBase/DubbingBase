import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import {
  getDubbingProjectsForMediaEndpoint,
  getEpisodePageDubbingProjectData,
  getEpisodePageProjectWorks,
} from "../../utils/db/queries";
import { parseEpisodeQuery, withMediaServiceTimeout } from "../../utils/media-request";
import { withTimeout } from "../../utils/with-timeout";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  if (query.projection === "episode-project") {
    const contentId = Number(query.id);
    const projectId = Number(query.project_id);
    if (
      !Number.isSafeInteger(contentId) ||
      contentId <= 0 ||
      !Number.isSafeInteger(projectId) ||
      projectId <= 0
    ) {
      throw createError({ statusCode: 400, message: "Invalid project_id" });
    }
    return await getEpisodePageProjectWorks(contentId, projectId);
  }
  const { id, seasonNumber, episodeNumber } = parseEpisodeQuery(query);
  const episodePageProjection = query.projection === "episode-page";
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = withMediaServiceTimeout(async () => {
      const result = await mediaService.getMediaWithVoiceActorsExtended(
        "episode",
        id,
        seasonNumber,
        episodeNumber,
        {
          projection:
            query.projection === "media-page" || episodePageProjection ? "media-page" : undefined,
        },
      );
      return { episode: result.media };
    }, "TMDB episode request");

    const dbDataPromise = withTimeout(
      Promise.resolve().then(async () => {
        const dbData = episodePageProjection
          ? await getEpisodePageDubbingProjectData(
              id,
              Number.isSafeInteger(Number(query.dub)) ? Number(query.dub) : undefined,
              acceptLanguage?.split(",")[0]?.trim(),
            )
          : {
              dubbingProjects: await getDubbingProjectsForMediaEndpoint(id, "tv", query.projection),
              voiceActors: [],
            };
        return {
          ...dbData,
          activeProjectId: "activeProjectId" in dbData ? dbData.activeProjectId : null,
          activeProjectWorks: "activeProjectWorks" in dbData ? dbData.activeProjectWorks : [],
          voteData: {},
        };
      }),
      10_000,
      "Supabase dubbing projects query",
    );

    const [apiData, dbData] = await Promise.all([apiDataPromise, dbDataPromise]);

    if (!apiData.episode) {
      throw createError({
        statusCode: 404,
        message: "Episode not found",
      });
    }

    const responseData = {
      episode: apiData.episode,
      dubbingProjects: dbData.dubbingProjects,
      ...(episodePageProjection ? { voiceActors: dbData.voiceActors } : {}),
      ...(episodePageProjection
        ? {
            activeProjectId: dbData.activeProjectId,
            activeProjectWorks: dbData.activeProjectWorks,
          }
        : {}),
      votes: dbData.voteData,
    };

    return responseData;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }
    console.error("Error fetching episode:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch episode data",
    });
  }
});
