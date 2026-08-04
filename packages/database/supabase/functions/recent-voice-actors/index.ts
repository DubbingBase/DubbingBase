import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";

interface RecentVoiceActorsParams {
  limit?: number;
}

const getRecentVoiceActors = async (
  ctx: SupabaseContext<Database>,
  limit = 10,
) => {
  try {
    const { data, error } = await ctx.supabase
      .from("voice_actors")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error fetching recent voice actors:", error);
    throw error;
  }
};

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { limit = 10 } = (await req
        .json()
        .catch(() => ({}))) as RecentVoiceActorsParams;

      // Validate limit parameter
      if (typeof limit !== "number" || limit < 1 || limit > 100) {
        return Response.json(
          { error: "Limit must be a number between 1 and 100" },
          { status: 400 },
        );
      }

      const results = await getRecentVoiceActors(ctx, limit);
      const resultsWithImageUrls = results.map((result) => ({
        ...result,
        profile_picture: buildSupabaseImageUrl(
          ctx,
          result.profile_picture,
          "voice_actor_profile_pictures",
          "500",
        ),
      }));

      return Response.json(resultsWithImageUrls);
    } catch (error) {
      console.error("Error in recent-voice-actors function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
