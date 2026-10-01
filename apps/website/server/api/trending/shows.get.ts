import { useTmdbClient } from "../../utils";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import {
  setNoCacheHeaders,
  setPublicCacheHeaders,
} from "../../utils/cache/http";
import { resolveLocaleLanguage } from "@app/shared-logic";

export default defineEventHandler(async (event) => {
  setNoCacheHeaders(event);
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

  setPublicCacheHeaders(event, "discovery");

  const tmdbClient = useTmdbClient();
  let json: Awaited<ReturnType<typeof tmdbClient.getTrending>>;
  try {
    json = await tmdbClient.getTrending("tv", "day", language);
  } catch (error) {
    setNoCacheHeaders(event);
    throw error;
  }
  try {
    if (!Array.isArray(json?.results)) {
      setNoCacheHeaders(event);
      return { ...json, results: [] };
    }
    return {
      ...json,
      results: json.results
        .filter((show: any) => show.adult !== true)
        .map((result: any) => ({
          ...result,
          backdrop_path: buildTmdbImageUrl(result.backdrop_path, "w780"),
          poster_path: buildTmdbImageUrl(result.poster_path, "w342"),
        })),
    };
  } catch (error) {
    setNoCacheHeaders(event);
    throw error;
  }
});
