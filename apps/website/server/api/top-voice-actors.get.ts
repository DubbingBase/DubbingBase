import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
  );

  const query = getQuery(event);
  const limit = Number(query.limit) || 10;

  if (typeof limit !== "number" || limit < 1 || limit > 100) {
    throw createError({
      statusCode: 400,
      message: "Limit must be a number between 1 and 100",
    });
  }

  try {
    const supabase = useSupabaseAdmin();
    const { data, error } = await supabase.rpc("get_top_voice_actors", {
      limit_param: limit,
    });

    if (error) throw error;

    const results = (data || []).map((result: any) => ({
      ...result.voice_actor,
      role_count: result.role_count,
      profile_picture: buildSupabaseImageUrl(
        result.voice_actor.profile_picture,
        "voice_actor_profile_pictures",
        "500",
      ),
    }));

    return results;
  } catch (error) {
    console.error("Error in top-voice-actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
