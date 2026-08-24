import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();

  const { data, error } = await supabaseAdmin.rpc(
    "find_duplicate_voice_actors_rpc",
  );

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  const formattedData =
    (data as any[])?.map((group: any) => ({
      ...group,
      actors: group.actors.map((actor: any) => ({
        ...actor,
        profile_picture: buildSupabaseImageUrl(actor.profile_picture),
      })),
    })) || [];

  return formattedData;
});
