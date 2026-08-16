import { withSupabase } from "npm:@supabase/server@^1";
import { purgeMediaForWork } from "../_shared/cache-purge.ts";
import { Database } from "../_shared/database.types.ts";

console.log("delete-voice-actor-link function started");

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const requestData = await req.json();
      const { id, targetUserId } = requestData;

      // Validate required fields
      if (!id) {
        return Response.json(
          { error: "Missing required field: id" },
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

      // Verify the work exists before attempting to delete
      const { data: existingWork, error: fetchError } = await ctx.supabase
        .from("work")
        .select("*")
        .eq("id", id)
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
              error: "Unauthorized: You can only delete your own work entries",
            },
            { status: 403 },
          );
        }
      }

      // Delete the work record
      const { error: deleteError } = await ctx.supabase
        .from("work")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting work:", deleteError);
        throw deleteError;
      }

      // Return success response
      await purgeMediaForWork(ctx.supabaseAdmin, id);

      return Response.json({
        success: true,
        message: "Voice actor link deleted successfully",
      });
    } catch (error) {
      console.error("Error in delete-voice-actor-link:", error);
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
