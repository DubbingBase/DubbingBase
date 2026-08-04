import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";

interface TopVoiceActorsParams {
  limit?: number;
}

const getTopVoiceActors = async (
  ctx: SupabaseContext<Database>,
  limit = 10,
) => {
  try {
    // Use RPC function to get aggregated data directly from database
    const { data, error } = await ctx.supabase.rpc("get_top_voice_actors", {
      limit_param: limit,
    });

    if (error) throw error;

    // Process profile pictures
    const resultsWithImageUrls = data.map((result: any) => ({
      ...result.voice_actor,
      role_count: result.role_count,
      profile_picture: buildSupabaseImageUrl(
        ctx,
        result.voice_actor.profile_picture,
        "voice_actor_profile_pictures",
        "500",
      ),
    }));

    return resultsWithImageUrls || [];
  } catch (error) {
    console.error("Error fetching top voice actors:", error);
    throw error;
  }
};

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { limit = 10 } = (await req
        .json()
        .catch(() => ({}))) as TopVoiceActorsParams;

      // Validate limit parameter
      if (typeof limit !== "number" || limit < 1 || limit > 100) {
        return Response.json(
          { error: "Limit must be a number between 1 and 100" },
          { status: 400 },
        );
      }

      const results = await getTopVoiceActors(ctx, limit);

      return Response.json(results);
    } catch (error) {
      console.error("Error in top-voice-actors function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
