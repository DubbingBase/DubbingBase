import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";
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
  const limit = Number(query.limit) || 10;
  const homeProjection = query.projection === "home";

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

    const results = (data || []).map((result) => {
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
          profile_picture: profilePicture,
        };
      }

      return {
        ...result.voice_actor,
        role_count: result.role_count,
        profile_picture: profilePicture,
      };
    });

    return results;
  } catch (error) {
    console.error("Error in top-voice-actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
