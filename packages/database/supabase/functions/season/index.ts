import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { TMDBClient } from "../_shared/tmdb.ts";
import { DatabaseClient } from "../_shared/database.ts";
import { MediaService } from "../_shared/media-service.ts";
import { cacheUtils } from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { id, season_number } = await req.json();

      if (!id || season_number === undefined) {
        return Response.json(
          { error: "Missing id or season_number" },
          { status: 400 },
        );
      }

      console.log("Fetching season:", { id, season_number });

      const tmdbClient = new TMDBClient(cacheUtils);
      const databaseClient = new DatabaseClient(ctx);
      const mediaService = new MediaService(databaseClient, tmdbClient, ctx);

      const result = await mediaService.getMediaWithVoiceActorsExtended(
        "season",
        id,
        season_number,
      );

      return Response.json({
        season: result.media,
        db_voice_actors: result.voice_actors,
      });
    } catch (error) {
      console.error("Error fetching season:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch season data",
        },
        { status: 500 },
      );
    }
  }),
};
