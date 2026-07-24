import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildTmdbImageUrl } from "../_shared/tmdb-urls.ts";
import { SimpleCache, redisClient, CACHE_KEYS } from "../_shared/index.ts";

const cacheKey = CACHE_KEYS.TMDB_TRENDING_SHOWS();

export default {
  fetch: withSupabase<Database>(
    { auth: "publishable:*" },
    async (_req, _ctx) => {
      try {
        const cache = new SimpleCache(new RedisClient());
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          console.log("Cache hit for trending shows");
          return Response.json(cachedData);
        }
      } catch (cacheErr) {
        console.error("Redis cache error:", cacheErr);
      }

      console.log("Cache miss for trending shows, fetching from TMDB");
      const response = await fetch(
        "https://api.themoviedb.org/3/trending/tv/day?language=fr-FR",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
            Accept: "application/json",
          },
        },
      );

      const json = await response.json();
      const trendingShows = {
        ...json,
        results: json.results.map((result: any) => ({
          ...result,
          backdrop_path: buildTmdbImageUrl(result.backdrop_path, "w780"),
          poster_path: buildTmdbImageUrl(result.poster_path, "w342"),
        })),
      };

      try {
        const cache = new SimpleCache(new RedisClient());
        await cache.set(cacheKey, trendingShows, "SHORT"); // 1 hour TTL
      } catch (cacheErr) {
        console.error("Failed to write to Redis cache:", cacheErr);
      }

      return Response.json(trendingShows);
    },
  ),
};
