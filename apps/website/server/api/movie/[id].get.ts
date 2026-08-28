import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects, getWorkVotes } from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
import { useSupabaseAdmin } from "../../utils/db/client";

export async function fetchMovieData(event: any, movieId: number) {
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const user = event.context.user;

  const cache = useCache();
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  const cacheKey = `app:movie:${movieId}:${acceptLanguage || "fr"}`;
  const cached = await cache.get<any>(cacheKey);

  let baseData = cached;

  if (!baseData) {
    // ── Parallel: TMDB + DB ──────────────────────────────────────────
    const apiDataPromise = mediaService
      .getMediaWithVoiceActors("movie", movieId)
      .then(async (result) => {
        const { characters: characterProfilePictures, tvdbId } =
          await mediaService.getCharacterProfilePictures(
            "movie",
            movieId,
            result.media,
          );
        return {
          movieWithImageUrls: result.media,
          characterProfilePictures,
          collection: result.collection,
          tvdbId,
        };
      })
      .catch((err) => {
        console.error(
          `Failed to fetch TMDB movie ${movieId}, using mock:`,
          err,
        );
        const mockMovie = {
          id: movieId,
          title: "Information indisponible (Timeout)",
          name: "Information indisponible (Timeout)",
          poster_path: null,
          backdrop_path: null,
          overview:
            "Ce contenu n'a pas pu être chargé car les serveurs TMDB sont inaccessibles.",
          credits: { cast: [] },
          release_date: "1970-01-01",
          first_air_date: "1970-01-01",
          external_ids: {},
        };
        return {
          movieWithImageUrls: processMedia(mockMovie),
          characterProfilePictures: [] as any[],
          collection: null,
          tvdbId: null,
        };
      });

    const dbDataPromise = getDubbingProjects(movieId, "movie").then(
      async (dubbingProjects) => {
        const workIds = dubbingProjects.flatMap(
          (p: any) => p.works?.map((w: any) => w.id) || [],
        );

        let voteData: Record<
          number,
          { up_count: number; down_count: number; user_vote: string | null }
        > = {};
        if (workIds.length > 0) {
          try {
            voteData = await getWorkVotes(workIds);
          } catch (voteError) {
            console.error("Error fetching vote data:", voteError);
          }
        }
        return { dubbingProjects, voteData };
      },
    );

    const [apiData, { dubbingProjects, voteData }] = await Promise.all([
      apiDataPromise,
      dbDataPromise,
    ]);

    const { movieWithImageUrls, characterProfilePictures, collection, tvdbId } =
      apiData;

    // ── Lazy Wikipedia Queue Enqueue ─────────────────────────────────
    const isProcessed = dubbingProjects.length > 0;
    const hasWiki = !!movieWithImageUrls?.external_ids?.wikidata_id;

    if (!isProcessed && hasWiki) {
      const supabaseAdmin = useSupabaseAdmin();
      void (async () => {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "movie",
          p_tmdb_id: movieId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) console.error("Failed to lazily enqueue movie:", error);
      })();
    }

    baseData = {
      movie: movieWithImageUrls,
      characterProfilePictures,
      dubbingProjects,
      votes: voteData,
      collection,
      tvdbId,
    };

    await cache.set(cacheKey, baseData, "SHORT");
  }

  // If user is authenticated, fetch their personal votes without polluting public cache
  if (user) {
    const workIds = (baseData.dubbingProjects || []).flatMap(
      (p: any) => p.works?.map((w: any) => w.id) || [],
    );
    if (workIds.length > 0) {
      try {
        const userVotes = await getWorkVotes(workIds, user.id);
        return {
          ...baseData,
          votes: userVotes,
        };
      } catch (err) {
        console.error("Error fetching user-specific votes for movie:", err);
      }
    }
  }

  return baseData;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const movieId = parseInt(id, 10);
  if (isNaN(movieId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  return await fetchMovieData(event, movieId);
});
