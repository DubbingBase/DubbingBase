import { useTmdbClient } from "../../utils";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import { setPublicCacheHeaders } from "../../utils/cache/http";

export default defineEventHandler(async (event) => {
  setPublicCacheHeaders(event, "discovery");

  const json = await useTmdbClient().getTrending("movie", "day");
  const trendingMovies = {
    ...json,
    results: (Array.isArray(json?.results) ? json.results : [])
      .filter((movie: any) => movie.adult !== true)
      .map((result: any) => ({
        ...result,
        backdrop_path: buildTmdbImageUrl(result.backdrop_path, "w780"),
        poster_path: buildTmdbImageUrl(result.poster_path, "w342"),
      })),
  };

  return trendingMovies;
});
