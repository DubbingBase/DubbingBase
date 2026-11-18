import type { H3Event } from "h3";
import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import {
  getDubbingProjectsForMediaEndpoint,
  getMediaPageDubbingProjectData,
} from "../../utils/db/queries";
import { processMedia } from "../../utils/urls/tmdb";
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
    const aggregateCredits = result.media?.aggregate_credits || (await aggregateCreditsPromise);

    const creditsWithImages = processMedia({
      credits:
        projection === "media-page"
          ? mediaPageAggregateCredits(aggregateCredits)
          : aggregateCredits,
    });
    return {
      serieWithImageUrls: result.media,
      aggregateCredits: creditsWithImages?.credits,
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

  const { serieWithImageUrls, aggregateCredits } = apiData;

  const baseData = {
    serie: serieWithImageUrls,
    aggregateCredits,
    dubbingProjects,
    ...(voiceActors === undefined ? {} : { voiceActors }),
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
