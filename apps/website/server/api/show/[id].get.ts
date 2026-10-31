import type { H3Event } from "h3";
import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import {
  getDubbingProjectsForMediaEndpoint,
  getMediaPageDubbingProjectData,
} from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { mediaPageAggregateCredits } from "../../utils/media-page-credits";
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
  const apiDataPromise = mediaService
    .getMediaWithVoiceActors("tv", showId)
    .then(async (result) => {
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
    })
    .catch((err) => {
      if (err instanceof Error && err.message === "TMDB API error: 404") {
        return {
          serieWithImageUrls: null,
          aggregateCredits: { cast: [] },
          characterProfilePictures: [],
          tvdbId: null,
        };
      }

      console.error(`Failed to fetch TMDB show ${showId}, using mock:`, err);
      const mockSerie = {
        id: showId,
        title: "Information indisponible (Timeout)",
        name: "Information indisponible (Timeout)",
        poster_path: null,
        backdrop_path: null,
        overview: "Ce contenu n'a pas pu être chargé car les serveurs TMDB sont inaccessibles.",
        credits: { cast: [] },
        release_date: "1970-01-01",
        first_air_date: "1970-01-01",
        external_ids: {},
      };
      return {
        serieWithImageUrls: processMedia(mockSerie),
        aggregateCredits: { cast: [] },
        characterProfilePictures: [],
        tvdbId: null,
      };
    });

  const dbDataPromise =
    projection === "media-page"
      ? getMediaPageDubbingProjectData(showId, "tv")
      : getDubbingProjectsForMediaEndpoint(showId, "tv", projection);

  const [apiData, dubbingProjectData] = await Promise.all([apiDataPromise, dbDataPromise]);
  const dubbingProjects = Array.isArray(dubbingProjectData)
    ? dubbingProjectData
    : dubbingProjectData.dubbingProjects;
  const voiceActors = Array.isArray(dubbingProjectData)
    ? undefined
    : dubbingProjectData.voiceActors;

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
    ...(voiceActors === undefined ? {} : { voiceActors }),
  };
  return baseData;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const showId = parseInt(id, 10);
  if (isNaN(showId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  return await fetchShowData(event, showId);
});
