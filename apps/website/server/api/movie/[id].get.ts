import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";

export async function fetchMovieData(event: any, movieId: number) {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const acceptLanguage = getHeader(event, "accept-language") || undefined;

  const cache = useCache(event);
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

    const dbDataPromise = getDubbingProjects(movieId, "movie");

    const [apiData, dubbingProjects] = await Promise.all([
      apiDataPromise,
      dbDataPromise,
    ]);

    const { movieWithImageUrls, characterProfilePictures, collection, tvdbId } =
      apiData;

    // ── Lazy Wikipedia Queue Enqueue ─────────────────────────────────
    const isProcessed = dubbingProjects.length > 0;
    const hasWiki = !!movieWithImageUrls?.external_ids?.wikidata_id;
    const isAdult = movieWithImageUrls?.adult === true;

    if (!isProcessed && hasWiki && !isAdult) {
      const supabaseAdmin = useSupabaseAdmin();
      try {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "movie",
          p_tmdb_id: movieId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) {
          if (!error.message?.includes("already in the")) {
            console.error("Failed to lazily enqueue movie:", error);
          }
        } else {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued movie **${movieWithImageUrls?.title || movieId}** (TMDB: ${movieId}) for all-languages dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(movieWithImageUrls?.poster_path
                ? {
                    imageUrl: `https://image.tmdb.org/t/p/w500${movieWithImageUrls.poster_path}`,
                  }
                : {}),
              url: `/movie/${movieId}`,
              color: 0x5865f2,
            },
          );
        }
      } catch (err) {
        console.error("Error auto-enqueueing movie:", err);
      }
    }

    baseData = {
      movie: movieWithImageUrls,
      characterProfilePictures,
      dubbingProjects,
      collection,
      tvdbId,
    };

    await cache.set(cacheKey, baseData, "SHORT");
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
