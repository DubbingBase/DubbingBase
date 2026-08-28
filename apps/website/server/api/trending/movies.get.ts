import { useCache } from "../../utils";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";

const cacheKey = CACHE_KEYS.TMDB_TRENDING_MOVIES();

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const cache = useCache();

  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const config = useRuntimeConfig();

  const response = await fetch(
    "https://api.themoviedb.org/3/trending/movie/day?language=fr-FR",
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tmdbApiKey}`,
        Accept: "application/json",
      },
    },
  );

  const json = await response.json();
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

  await cache.set(cacheKey, trendingMovies, "SHORT");

  return trendingMovies;
});
