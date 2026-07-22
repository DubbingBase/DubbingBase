import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const {
        action,
        mediaType,
        mediaId,
        tmdbId,
        seasonNumber,
        episodeNumber,
      } = await req.json();

      if (!action || !mediaType) {
        return Response.json(
          { error: "Missing required parameters" },
          { status: 400 },
        );
      }

      if (action === "status") {
        const { data, error } = await ctx.supabase.rpc(
          "get_media_queue_status",
          {
            p_media_type: mediaType,
            p_tmdb_id: tmdbId || mediaId,
            p_season_number: seasonNumber,
            p_episode_number: episodeNumber,
          },
        );

        if (error) throw error;
        return Response.json({ data });
      } else if (action === "enqueue") {
        const { error } = await ctx.supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: mediaType,
          p_tmdb_id: tmdbId || mediaId,
          p_season_number: seasonNumber,
          p_episode_number: episodeNumber,
        });

        if (error) throw error;
        return Response.json({ success: true });
      }

      return Response.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
      console.error("Error in media-queue function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
