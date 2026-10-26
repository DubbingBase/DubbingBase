import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";
import { z } from "zod";

const duplicateActorSchema = z
  .object({ profile_picture: z.string().nullable().optional() })
  .passthrough();
const duplicateGroupsSchema = z.array(
  z.object({ actors: z.array(duplicateActorSchema) }).passthrough(),
);

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();

  const { data, error } = await supabaseAdmin.rpc("find_duplicate_voice_actors_rpc");

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  const groups = duplicateGroupsSchema.parse(data ?? []);
  const formattedData = groups.map((group) => ({
    ...group,
    actors: group.actors.map((actor) => ({
      ...actor,
      profile_picture: buildSupabaseImageUrl(actor.profile_picture),
    })),
  }));

  return formattedData;
});
