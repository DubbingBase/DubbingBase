import { useSupabaseAdmin } from "../../utils/db/client";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import type { Json } from "@app/supabase/types";

type VoiceActorRecord = Record<string, Json> & {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
};

function isVoiceActorRecord(value: Json): value is VoiceActorRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof Reflect.get(value, "id") === "number" &&
    typeof Reflect.get(value, "firstname") === "string" &&
    typeof Reflect.get(value, "lastname") === "string" &&
    (typeof Reflect.get(value, "profile_picture") === "string" ||
      Reflect.get(value, "profile_picture") === null)
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  const months = query.months === undefined ? 6 : Number(query.months);
  const homeProjection = query.projection === "home";

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

    return (data || []).map((result) => {
      if (!isVoiceActorRecord(result.voice_actor)) {
        throw new Error("Invalid voice actor data");
      }

      const profilePicture = buildSupabaseImageUrl(
        result.voice_actor.profile_picture,
        "voice_actor_profile_pictures",
        "500",
      );

      if (homeProjection) {
        return {
          id: result.voice_actor.id,
          firstname: result.voice_actor.firstname,
          lastname: result.voice_actor.lastname,
          work_count: result.work_count,
          profile_picture: profilePicture,
        };
      }

      return {
        ...result.voice_actor,
        work_count: result.work_count,
        profile_picture: profilePicture,
      };
    });
  } catch (error: unknown) {
    console.error("Error in trending voice actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
