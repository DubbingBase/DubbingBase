import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      console.log("user.id", user.id);

      // Fetch all voice_actor links for the user
      const { data: voiceActorLinks, error: vaLinkError } = await ctx.supabase
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id);

      if (vaLinkError) {
        console.error("Error fetching voice actor links:", vaLinkError);
        return Response.json(
          { error: "Failed to fetch user profile" },
          { status: 500 },
        );
      }

      // Fetch user profile directly
      const { data: userProfile, error: profileError } = await ctx.supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("userProfile", userProfile);

      if (profileError && profileError.code !== "PGRST116") {
        // PGRST116 is "not found"
        console.error("Error fetching user profile:", profileError);
        return Response.json(
          { error: "Failed to fetch user profile" },
          { status: 500 },
        );
      }

      // Fetch voice actor profiles
      const voiceActors = [];
      if (voiceActorLinks && voiceActorLinks.length > 0) {
        for (const link of voiceActorLinks) {
          const { data: voiceActorData, error: vaError } = await ctx.supabase
            .from("voice_actors")
            .select("*")
            .eq("id", link.voice_actor_id)
            .single();

          if (vaError) {
            console.error("Error fetching voice actor:", vaError);
            continue; // Skip this one
          }

          voiceActors.push(voiceActorData);
        }
      }

      // Determine primary voice actor (first one for now)
      const primaryVoiceActor = voiceActors.length > 0 ? voiceActors[0] : null;

      // Return structured data
      return Response.json({
        user_profile: userProfile,
        voice_actors: voiceActors,
        primary_voice_actor_id: primaryVoiceActor ? primaryVoiceActor.id : null,
        // Backward compatibility: if only one voice actor, include as single profile
        ...(voiceActors.length === 1
          ? {
              type: "voice_actor",
              profile: voiceActors[0],
            }
          : {}),
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
