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

      const [dubbingProjects, characterProfilePictures] = await Promise.all([
        databaseClient.getDubbingProjects(id, "tv"),
        mediaService.getCharacterProfilePictures("tv", id, result.media)
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
        season: result.media,
        dubbingProjects: dubbingProjects,
        characterProfilePictures: characterProfilePictures,
        votes: voteData,
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
