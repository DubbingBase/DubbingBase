import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import {
  setNoCacheHeaders,
  setPublicCacheHeaders,
} from "../../utils/cache/http";

export async function fetchShowData(event: any, showId: number) {
  setPublicCacheHeaders(event, "detail");

  const acceptLanguage = getHeader(event, "accept-language") || undefined;

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
        await mediaService.getCharacterProfilePictures(
          "tv",
          showId,
          result.media,
        );

      const aggregateCredits =
        result.media.aggregate_credits || (await aggregateCreditsPromise);

      const creditsWithImages = processMedia({ credits: aggregateCredits });
      return {
        serieWithImageUrls: result.media,
        aggregateCredits: creditsWithImages.credits,
        characterProfilePictures,
        tvdbId,
      };
    })
    .catch((err) => {
      setNoCacheHeaders(event);
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
        overview:
          "Ce contenu n'a pas pu être chargé car les serveurs TMDB sont inaccessibles.",
        credits: { cast: [] },
        release_date: "1970-01-01",
        first_air_date: "1970-01-01",
        external_ids: {},
      };
      return {
        serieWithImageUrls: processMedia(mockSerie),
        aggregateCredits: { cast: [] } as any,
        characterProfilePictures: [] as any[],
        tvdbId: null,
      };
    });

  const dbDataPromise = getDubbingProjects(showId, "tv");

  const [apiData, dubbingProjects] = await Promise.all([
    apiDataPromise,
    dbDataPromise,
  ]);

  const {
    serieWithImageUrls,
    aggregateCredits,
    characterProfilePictures,
    tvdbId,
  } = apiData;

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

  const showId = parseInt(id, 10);
  if (isNaN(showId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  return await fetchShowData(event, showId);
});
