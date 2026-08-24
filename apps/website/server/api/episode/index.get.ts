import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { useSupabaseAdmin } from "../../utils/db/client";
import { getDubbingProjects, getWorkVotes } from "../../utils/db/queries";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id ? Number(query.id) : undefined;
  const seasonNumber =
    query.season_number !== undefined ? Number(query.season_number) : undefined;
  const episodeNumber =
    query.episode_number !== undefined
      ? Number(query.episode_number)
      : undefined;

  if (!id || seasonNumber === undefined || episodeNumber === undefined) {
    throw createError({
      statusCode: 400,
      message: "Missing id, season_number or episode_number",
    });
  }

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = mediaService
      .getMediaWithVoiceActorsExtended(
        "episode",
        id,
        seasonNumber,
        episodeNumber,
      )
      .then(async (result) => {
        const characterProfilePictures =
          await mediaService.getCharacterProfilePictures(
            "tv",
            id,
            result.media,
          );
        return { episode: result.media, characterProfilePictures };
      });

    const dbDataPromise = getDubbingProjects(id, "tv").then(
      async (dubbingProjects) => {
        const workIds = dubbingProjects.flatMap(
          (p: any) => p.works?.map((w: any) => w.id) || [],
        );
        let voteData = {};
        if (workIds.length > 0) {
          try {
            const user = event.context.user;
            if (user) {
              voteData = await getWorkVotes(workIds, user.id);
            } else {
              voteData = await getWorkVotes(workIds);
            }
          } catch (voteError) {
            console.error("Error fetching vote data:", voteError);
          }
        }
        return { dubbingProjects, voteData };
      },
    );

    const [apiData, dbData] = await Promise.all([
      apiDataPromise,
      dbDataPromise,
    ]);

    return {
      episode: apiData.episode,
      dubbingProjects: dbData.dubbingProjects,
      characterProfilePictures: apiData.characterProfilePictures,
      votes: dbData.voteData,
    };
  } catch (error) {
    console.error("Error fetching episode:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to fetch episode data",
    });
  }
});
