import type { H3Event } from "h3";
import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { withMediaServiceTimeout } from "../../utils/media-request";
export async function fetchMovieData(event: H3Event, movieId: number) {
  const acceptLanguage = getHeader(event, "accept-language") || undefined;

  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  // ── Parallel: TMDB + DB ──────────────────────────────────────────
  const projection = getQuery(event).projection;
  const apiDataPromise = withMediaServiceTimeout(
    () =>
      mediaService.getMediaWithVoiceActors("movie", movieId, {
        includeCollection: projection !== "media-page",
        includeCreditsCrew: projection !== "media-page",
        ...(projection === "media-page" ? { projection: "media-page" } : {}),
      }),
    "TMDB movie",
  ).then(async (result) => {
    const { characters: characterProfilePictures, tvdbId } =
      await mediaService.getCharacterProfilePictures("movie", movieId, result.media);
    return {
      movieWithImageUrls: result.media,
      characterProfilePictures,
      collection: result.collection,
      tvdbId,
    };
  });

  const dbDataPromise = getDubbingProjectsForMediaEndpoint(movieId, "movie", projection);

  const [apiData, dubbingProjects] = await Promise.all([apiDataPromise, dbDataPromise]);

  const { movieWithImageUrls, characterProfilePictures, collection, tvdbId } = apiData;

  // ── Lazy Wikipedia Queue Enqueue ─────────────────────────────────
  // Gated by PostHog 'enqueue-on-navigate' (server-side)
  const isProcessed = dubbingProjects.length > 0;
  const hasWiki = !!movieWithImageUrls?.external_ids?.wikidata_id;
  const isAdult = movieWithImageUrls?.adult === true;

  if (!isProcessed && hasWiki && !isAdult) {
    scheduleBackgroundTask(
      event,
      async () => {
        if (!(await isEnqueueOnNavigateEnabled())) return;

        const supabaseAdmin = useSupabaseAdmin(event);
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
              event,
            },
          );
        }
      },
      "movie discovery",
    );
  }

  const baseData = {
    movie: movieWithImageUrls,
    characterProfilePictures,
    dubbingProjects,
    collection,
    tvdbId,
  };

  return baseData;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Movie not found" });
  }

  return await fetchMovieData(event, movieId);
});
