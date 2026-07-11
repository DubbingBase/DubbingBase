import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

console.log("update_voice_actor_link function started");

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const requestData = await req.json();
      const { work_id, performance, targetUserId } = requestData;

      // Validate required fields
      if (!work_id || !performance) {
        return Response.json(
          {
            error:
              "Missing required fields: work_id and performance are required",
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
          { error: "Unauthorized: Admin access required for impersonation" },
          { status: 403 },
        );
      }

      // Verify the work exists before attempting to update
      const { data: existingWork, error: fetchError } = await ctx.supabase
        .from("work")
        .select("*")
        .eq("id", work_id)
        .single();

      if (fetchError || !existingWork) {
        return Response.json({ error: "Work not found" }, { status: 404 });
      }

      // If targetUserId is provided, verify the work belongs to the target user's voice actor
      if (targetUserId) {
        const { data: targetUserData, error: targetError } =
          await ctx.supabaseAdmin.auth.admin.getUserById(targetUserId);
        if (targetError || !targetUserData.user) {
          return Response.json(
            { error: "Target user not found" },
            { status: 404 },
          );
        }

        const targetUserVoiceActorId =
          targetUserData.user.user_metadata?.voice_actor_id;
        if (targetUserVoiceActorId !== (existingWork as any).voice_actor_id) {
          return Response.json(
            { error: "Target user does not own this work entry" },
            { status: 403 },
          );
        }
      } else {
        // For non-admin users, verify they own this work entry
        const userVoiceActorId = user.userMetadata?.voice_actor_id;
        if (
          !isAdmin &&
          userVoiceActorId !== (existingWork as any).voice_actor_id
        ) {
          return Response.json(
            {
              error: "Unauthorized: You can only update your own work entries",
            },
            { status: 403 },
          );
        }
      }

      // Update the work record
      const { data: updatedWork, error: updateError } = await ctx.supabase
        .from("work")
        .update({ performance })
        .eq("id", work_id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating work:", updateError);
        throw updateError;
      }

      // Return success response
      return Response.json(updatedWork);
    } catch (error) {
      console.error("Error in update_voice_actor_link:", error);
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
