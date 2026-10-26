import { useSupabaseAdmin } from "../../utils/db/client";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  const months = query.months === undefined ? 6 : Number(query.months);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError({
      statusCode: 400,
      message: "Limit must be a number between 1 and 100",
    });
  }

  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw createError({
      statusCode: 400,
      message: "Months must be a number between 1 and 24",
    });
  }
  try {
    const supabase = useSupabaseAdmin();
    const { data, error } = await supabase.rpc("get_trending_voice_actors", {
      limit_param: limit,
      months_param: months,
    });

    if (error) throw error;

    return (data || []).flatMap((result) => {
      const voiceActor = result.voice_actor;
      if (!isRecord(voiceActor)) return [];
      const profilePicture = voiceActor.profile_picture;

      return [
        {
          ...voiceActor,
          work_count: result.work_count,
          profile_picture: buildSupabaseImageUrl(
            typeof profilePicture === "string" ? profilePicture : null,
            "voice_actor_profile_pictures",
            "500",
          ),
        },
      ];
    });
  } catch (error: unknown) {
    console.error("Error in trending voice actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
