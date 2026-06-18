import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "PUT" && req.method !== "PATCH") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = await req.json();
      const { voice_actor_id, updates, targetUserId } = body;

      if (!voice_actor_id) {
        return Response.json(
          { error: "voice_actor_id is required" },
          { status: 400 },
        );
      }

      // Determine which user to check permissions for
      const userIdToCheck = targetUserId || user.id;

      // Check if the user has permission to update this voice actor
      const { data: linkData, error: linkError } = await ctx.supabase
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", userIdToCheck)
        .eq("voice_actor_id", voice_actor_id)
        .single();

      if (linkError || !linkData) {
        return Response.json(
          { error: "Unauthorized to update this voice actor" },
          { status: 403 },
        );
      }

      // Prepare update data
      const updateData: any = { ...updates };
      updateData.updated_at = new Date().toISOString();

      // Update voice actor
      const { data: voiceActorData, error: vaError } = await ctx.supabase
        .from("voice_actors")
        .update(updateData)
        .eq("id", voice_actor_id)
        .select()
        .single();

      if (vaError) {
        console.error("Error updating voice actor:", vaError);
        return Response.json(
          { error: "Failed to update voice actor" },
          { status: 500 },
        );
      }

      return Response.json({ profile: voiceActorData });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
