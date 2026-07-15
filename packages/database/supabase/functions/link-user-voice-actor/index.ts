import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

interface LinkUserVoiceActorRequest {
  user_id: string;
  voice_actor_id: number;
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if user is admin
      const isAdmin =
        user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";
      if (!isAdmin) {
        return Response.json(
          { error: "Unauthorized: Admin access required" },
          { status: 403 },
        );
      }

      // Parse request body
      const body = await req.json();
      const user_id = body.user_id || body.targetUserId || user.id;
      const voice_actor_id = body.voice_actor_id;

      if (!user_id || !voice_actor_id) {
        return Response.json(
          { error: "Missing user_id or voice_actor_id" },
          { status: 400 },
        );
      }

      // Verify voice actor exists
      const { data: voiceActor, error: vaError } = await ctx.supabase
        .from("voice_actors")
        .select("id")
        .eq("id", voice_actor_id)
        .single();

      if (vaError || !voiceActor) {
        return Response.json(
          { error: "Voice actor not found" },
          { status: 404 },
        );
      }

      // Check if link already exists
      const { data: existingLink, error: checkError } = await ctx.supabase
        .from("user_voice_actor_links")
        .select("id")
        .eq("user_id", user_id)
        .eq("voice_actor_id", voice_actor_id)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing link:", checkError);
        return Response.json(
          { error: "Failed to check existing link" },
          { status: 500 },
        );
      }

      if (existingLink) {
        return Response.json(
          { error: "User is already linked to this voice actor" },
          { status: 400 },
        );
      }

      // Insert link in user_voice_actor_links table
      const { error: insertError } = await ctx.supabase
        .from("user_voice_actor_links")
        .insert({ user_id, voice_actor_id });

      if (insertError) {
        console.error("Error linking user to voice actor:", insertError);
        return Response.json(
          { error: "Failed to link user to voice actor" },
          { status: 500 },
        );
      }

      return Response.json({
        success: true,
        message: "User linked to voice actor successfully",
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
