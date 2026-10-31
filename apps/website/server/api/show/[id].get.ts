import type { H3Event } from "h3";
import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { mediaPageAggregateCredits } from "../../utils/media-page-credits";
import { withMediaServiceTimeout } from "../../utils/media-request";
export async function fetchShowData(event: H3Event, showId: number) {
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const projection = getQuery(event).projection;

  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  // ── Aggregate credits (separate cache layer) ────────────────────
  const aggregateCreditsPromise = tmdbClient
    .fetchMediaCredits("tv", showId, acceptLanguage || "fr-FR")
    .catch((err) => {
      console.error(`Failed to fetch TMDB show credits ${showId}:`, err);
      return { cast: [] };
    });

  // ── Parallel: TMDB + DB ──────────────────────────────────────────
  const apiDataPromise = withMediaServiceTimeout(
    () => mediaService.getMediaWithVoiceActors("tv", showId),
    "TMDB show",
  ).then(async (result) => {
    const { characters: characterProfilePictures, tvdbId } =
      await mediaService.getCharacterProfilePictures("tv", showId, result.media);

    const aggregateCredits = result.media.aggregate_credits || (await aggregateCreditsPromise);

    const creditsWithImages = processMedia({
      credits:
        projection === "media-page"
          ? mediaPageAggregateCredits(aggregateCredits)
          : aggregateCredits,
    });
    return {
      serieWithImageUrls: result.media,
      aggregateCredits: creditsWithImages.credits,
      characterProfilePictures,
      tvdbId,
    };
  });

  const dbDataPromise = getDubbingProjectsForMediaEndpoint(showId, "tv", projection);

  const [apiData, dubbingProjects] = await Promise.all([apiDataPromise, dbDataPromise]);

  const { serieWithImageUrls, aggregateCredits, characterProfilePictures, tvdbId } = apiData;

  // ── Lazy Wikipedia Queue Enqueue ─────────────────────────────────
  // Gated by PostHog 'enqueue-on-navigate' (server-side)
  const isProcessed = dubbingProjects.length > 0;
  const hasWiki = !!serieWithImageUrls?.external_ids?.wikidata_id;
  const isAdult = serieWithImageUrls?.adult === true;

  if (!isProcessed && hasWiki && !isAdult) {
    scheduleBackgroundTask(
      event,
      async () => {
        if (!(await isEnqueueOnNavigateEnabled())) return;

        const supabaseAdmin = useSupabaseAdmin(event);
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "tv",
          p_tmdb_id: showId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) {
          if (!error.message?.includes("already in the")) {
            console.error("Failed to lazily enqueue show:", error);
          }
        } else {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued TV show **${serieWithImageUrls?.name || showId}** (TMDB: ${showId}) for all-languages dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(serieWithImageUrls?.poster_path
                ? {
                    imageUrl: `https://image.tmdb.org/t/p/w500${serieWithImageUrls.poster_path}`,
                  }
                : {}),
              url: `/show/${showId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "show discovery",
    );
  }

  const baseData = {
    serie: serieWithImageUrls,
    aggregateCredits,
    characterProfilePictures,
    dubbingProjects,
    tvdbId,
  };

  return baseData;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const showId = Number(id);
  if (!Number.isSafeInteger(showId) || showId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Show not found" });
  }

  return await fetchShowData(event, showId);
});
