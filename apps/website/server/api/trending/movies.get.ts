import { useTmdbClient } from "../../utils";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import { readProperty, resolveLocaleLanguage } from "@app/shared-logic";

function isTrendingMovie(value: unknown): value is {
  id: number;
  title?: string;
  adult?: boolean;
  backdrop_path?: string | null;
  poster_path?: string | null;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const id = readProperty(value, "id");
  const adult = readProperty(value, "adult");
  const title = readProperty(value, "title");
  const backdropPath = readProperty(value, "backdrop_path");
  const posterPath = readProperty(value, "poster_path");
  return (
    typeof id === "number" &&
    Number.isFinite(id) &&
    (title === undefined || typeof title === "string") &&
    (adult === undefined || typeof adult === "boolean") &&
    (backdropPath === undefined || backdropPath === null || typeof backdropPath === "string") &&
    (posterPath === undefined || posterPath === null || typeof posterPath === "string")
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawLanguage = query.lang;
  const language = resolveLocaleLanguage(
    rawLanguage === undefined ? undefined : typeof rawLanguage === "string" ? rawLanguage : "",
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
      .map((result) => {
        const posterPath = buildTmdbImageUrl(result.poster_path, "w342");

        if (query.projection === "card") {
          return {
            id: result.id,
            title: result.title,
            poster_path: posterPath,
          };
        }

        return {
          ...result,
          backdrop_path: buildTmdbImageUrl(result.backdrop_path, "w780"),
          poster_path: posterPath,
        };
      }),
  };

  setPublicCacheHeaders(event, "discovery");
  return trendingMovies;
});
