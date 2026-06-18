import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildTmdbImageUrl } from "../_shared/tmdb-urls.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: "publishable:*" },
    async (_req, _ctx) => {
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

      return Response.json(trendingShows);
    },
  ),
};
