import type { H3Event } from "h3";
import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import {
  getDubbingProjectsForMediaEndpoint,
  getMediaPageDubbingProjectData,
} from "../../utils/db/queries";
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
  ).then((result) => ({
    movieWithImageUrls: result.media,
    collection: result.collection,
  }));

  const dbDataPromise =
    projection === "media-page"
      ? getMediaPageDubbingProjectData(movieId, "movie")
      : getDubbingProjectsForMediaEndpoint(movieId, "movie", projection);

  const [apiData, dubbingProjectData] = await Promise.all([apiDataPromise, dbDataPromise]);
  const dubbingProjects = Array.isArray(dubbingProjectData)
    ? dubbingProjectData
    : dubbingProjectData.dubbingProjects;
  const voiceActors = Array.isArray(dubbingProjectData)
    ? undefined
    : dubbingProjectData.voiceActors;

  const { movieWithImageUrls, collection } = apiData;

  const baseData = {
    movie: movieWithImageUrls,
    dubbingProjects,
    collection,
    ...(voiceActors === undefined ? {} : { voiceActors }),
  };
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
