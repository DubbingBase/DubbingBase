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
      const { id, season_number, episode_number } = await req.json();

      if (!id || season_number === undefined || episode_number === undefined) {
        return Response.json(
          { error: "Missing id, season_number or episode_number" },
          { status: 400 },
        );
      }

      console.log("Fetching episode:", { id, season_number, episode_number });

      const tmdbClient = new TMDBClient(cacheUtils);
      const databaseClient = new DatabaseClient(ctx);
      const mediaService = new MediaService(databaseClient, tmdbClient, ctx);

      const result = await mediaService.getMediaWithVoiceActorsExtended(
        "episode",
        id,
        season_number,
        episode_number,
      );

      return Response.json({
        episode: result.media,
        db_voice_actors: result.voice_actors,
      });
    } catch (error) {
      console.error("Error fetching episode:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch episode data",
        },
        { status: 500 },
      );
    }
  }),
};
