import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@app/shared-logic";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireUser } from "../utils/auth";
async function fetchVoiceActors(supabaseAdmin: SupabaseClient<Database>, voiceActorIds: number[]) {
  if (voiceActorIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("voice_actors")
    .select("*")
    .in("id", voiceActorIds);

  if (error) {
    console.error("Error fetching voice actors:", error);
    return [];
  }
  return data || [];
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabaseAdmin = useSupabaseAdmin();

  try {
    // Fetch all voice_actor links for the user
    const { data: voiceActorLinks, error: vaLinkError } = await supabaseAdmin
      .from("user_voice_actor_links")
      .select("voice_actor_id")
      .eq("user_id", user.id);

    if (vaLinkError) {
      console.error("Error fetching voice actor links:", vaLinkError);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch user profile",
      });
    }

    // Fetch user profile directly
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      throw createError({
        statusCode: 500,
        message: "Failed to fetch user profile",
      });
    }

    // Fetch voice actor profiles in a single query
    const voiceActorIds = voiceActorLinks?.map((l) => l.voice_actor_id) || [];
    const voiceActors = await fetchVoiceActors(supabaseAdmin, voiceActorIds);

    const primaryVoiceActor = voiceActors.length > 0 ? voiceActors[0] : null;

    return {
      user_profile: userProfile,
      voice_actors: voiceActors,
      primary_voice_actor_id: primaryVoiceActor ? primaryVoiceActor.id : null,
      ...(voiceActors.length === 1
        ? {
            type: "voice_actor",
            profile: voiceActors[0],
          }
        : {}),
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("Unexpected error in get-user-profile:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
