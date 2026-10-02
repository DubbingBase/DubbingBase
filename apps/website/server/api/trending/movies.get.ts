import { useTmdbClient } from "../../utils";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import { resolveLocaleLanguage } from "@app/shared-logic";

function isTrendingMovie(value: unknown): value is {
  adult?: boolean;
  backdrop_path?: string | null;
  poster_path?: string | null;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const id = Reflect.get(value, "id");
  const adult = Reflect.get(value, "adult");
  const backdropPath = Reflect.get(value, "backdrop_path");
  const posterPath = Reflect.get(value, "poster_path");
  return (
    typeof id === "number" &&
    Number.isFinite(id) &&
    (adult === undefined || typeof adult === "boolean") &&
    (backdropPath === undefined ||
      backdropPath === null ||
      typeof backdropPath === "string") &&
    (posterPath === undefined ||
      posterPath === null ||
      typeof posterPath === "string")
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawLanguage = query.lang;
  const language = resolveLocaleLanguage(
    rawLanguage === undefined
      ? undefined
      : typeof rawLanguage === "string"
        ? rawLanguage
        : "",
  );
  if (language === null) {
    throw createError({ statusCode: 400, message: "Unsupported language" });
  }

  const tmdbClient = useTmdbClient();
  const json = await tmdbClient.getTrending("movie", "day", language);
  if (
    typeof json !== "object" ||
    json === null ||
    !Array.isArray(json.results) ||
    !json.results.every(isTrendingMovie)
  ) {
    return { ...json, results: [] };
  }

  const trendingMovies = {
    ...json,
    results: json.results
      .filter((movie) => movie.adult !== true)
      .map((result) => ({
        ...result,
        backdrop_path: buildTmdbImageUrl(result.backdrop_path, "w780"),
        poster_path: buildTmdbImageUrl(result.poster_path, "w342"),
      })),
  };

  setPublicCacheHeaders(event, "discovery");
  return trendingMovies;
});
