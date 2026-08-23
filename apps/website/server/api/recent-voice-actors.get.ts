import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

export default defineEventHandler(async (event) => {
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
    const { data: rows, error } = await supabase
      .from("voice_actors")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const results = (rows || []).map((row: any) => ({
      ...row,
      profile_picture: buildSupabaseImageUrl(
        row.profile_picture,
        "voice_actor_profile_pictures",
        "500",
      ),
    }));

    return results;
  } catch (error) {
    console.error("Error in recent-voice-actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
