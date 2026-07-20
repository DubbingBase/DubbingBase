import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { findOrCreateDubbingProject } from "../_shared/dubbing-project.ts";

console.log("link-voice-actor function started");

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requestData = await req.json();
      const {
        voice_actor_id,
        media_type,
        media_id,
        character_name,
        role,
        targetUserId,
        actor_id,
      } = requestData;

      if (!voice_actor_id || !media_type || !media_id || !actor_id) {
        return Response.json(
          {
            error:
              "Missing required fields: actor_id, voice_actor_id, media_type, and media_id are required",
          },
          { status: 400 },
        );
      }

      // Check if user is admin for impersonation
      const isAdmin =
        user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";

      if (targetUserId && !isAdmin) {
        return Response.json(
          {
            error: "Unauthorized: Admin access required for impersonation",
          },
          { status: 403 },
        );
      }

      // Validate media_type
      const validMediaTypes = ["movie", "tv"];
      if (!validMediaTypes.includes(media_type)) {
        return Response.json(
          {
            error: "Invalid media_type. Must be one of: movie, tv",
          },
          { status: 400 },
        );
      }

      // Verify voice actor exists
      const { data: voiceActor, error: voiceActorError } = await ctx.supabase
        .from("voice_actors")
        .select("*")
        .eq("id", voice_actor_id)
        .single();

      if (voiceActorError || !voiceActor) {
        return Response.json(
          { error: "Voice actor not found" },
          { status: 404 },
        );
      }

      // Check if the link already exists
      const query = ctx.supabase
        .from("work")
        .select("*")
        .eq("voice_actor_id", voice_actor_id)
        .eq("content_type", media_type)
        .eq("content_id", media_id);

      if (actor_id) {
        query.eq("actor_id", actor_id);
      } else {
        query.is("actor_id", null);
      }
      const { data: existingLink, error: linkCheckError } =
        await query.maybeSingle();

      if (linkCheckError) {
        console.error("Error checking for existing link:", linkCheckError);
        throw linkCheckError;
      }

      let result;

      if (existingLink) {
        result = existingLink;
      } else {
        const dubbing_project_id = await findOrCreateDubbingProject(
          ctx.supabase,
          media_id,
          media_type
        );

        // Create new link
        const insertData = {
          voice_actor_id,
          content_type: media_type,
          content_id: media_id,
          performance: character_name || role || "dialogues",
          status: "user",
          actor_id: actor_id || null,
          dubbing_project_id,
        };

        const { data, error } = await ctx.supabase
          .from("work")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Get the full voice actor details to return
      const { data: voiceActorDetails, error: detailsError } =
        await ctx.supabase
          .from("voice_actors")
          .select("*")
          .eq("id", voice_actor_id)
          .single();

      if (detailsError) throw detailsError;

      const response = {
        ...(result as any),
        voiceActorDetails: voiceActorDetails,
      };

      return Response.json(response);
    } catch (error) {
      console.error("Error in link-voice-actor:", error);
      const err = error as any;
      return Response.json(
        {
          error: err?.message || "Internal server error",
          details: err?.details || null,
        },
        { status: 500 },
      );
    }
  }),
};
