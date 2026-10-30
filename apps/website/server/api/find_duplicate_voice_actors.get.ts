import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();

  const { data, error } = await supabaseAdmin.rpc("find_duplicate_voice_actors_rpc");

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  if (data === null) return [];
  if (!Array.isArray(data)) {
    throw createError({ statusCode: 500, message: "Unexpected duplicate voice actor data" });
  }
  const formattedData: unknown[] = data;
  for (const group of formattedData) {
    if (!isRecord(group) || !Array.isArray(group.actors)) {
      throw createError({ statusCode: 500, message: "Unexpected duplicate voice actor data" });
    }
    const actors: unknown[] = group.actors;
    for (const actor of actors) {
      if (!isRecord(actor)) {
        throw createError({ statusCode: 500, message: "Unexpected duplicate voice actor data" });
      }
      const profilePicture = actor.profile_picture;
      if (
        profilePicture !== undefined &&
        profilePicture !== null &&
        typeof profilePicture !== "string"
      ) {
        throw createError({ statusCode: 500, message: "Unexpected duplicate voice actor data" });
      }
      actor.profile_picture = buildSupabaseImageUrl(profilePicture);
    }
  }

  return formattedData;
});
