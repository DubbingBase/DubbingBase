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

      const [result, dubbingProjects] = await Promise.all([
        mediaService.getMediaWithVoiceActorsExtended(
          "episode",
          id,
          season_number,
          episode_number,
        ),
        databaseClient.getDubbingProjects(id, "episode"),
      ]);

      const workIds = dubbingProjects.flatMap(
        (p: any) => p.works?.map((w: any) => w.id) || [],
      );
      let voteData = {};
      if (workIds.length > 0) {
        try {
          const user = ctx.userClaims;
          if (user) {
            voteData = await databaseClient.getWorkVotes(workIds, user.id);
          } else {
            voteData = await databaseClient.getWorkVotes(workIds);
          }
        } catch (voteError) {
          console.error("Error fetching vote data:", voteError);
        }
      }

      return Response.json({
        episode: result.media,
        dubbingProjects: dubbingProjects,
        votes: voteData,
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
