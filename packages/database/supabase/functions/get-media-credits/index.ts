import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getParams } from "../_shared/index.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, _ctx) => {
    try {
      const { media_type, media_id } = await getParams(req);

      if (!media_type || !media_id) {
        return Response.json(
          { error: "media_type and media_id are required" },
          { status: 400 },
        );
      }

      const endpoint = media_type === "tv" ? "aggregate_credits" : "credits";
      const response = await fetch(
        `https://api.themoviedb.org/3/${media_type}/${media_id}/${endpoint}?language=fr-FR`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch from TMDB: status ${response.status}`);
      }

      const data = await response.json();

      return Response.json(data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return Response.json({ error: errorMsg }, { status: 500 });
    }
  }),
};
