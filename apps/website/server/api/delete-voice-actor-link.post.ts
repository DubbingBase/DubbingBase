import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const body = await readBody(event);
    const { id, targetUserId } = body;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Missing required field: id",
      });
    }

    const isAdmin =
      user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin" ||
      (user as any).role === "admin";

    if (targetUserId && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: "Unauthorized: Admin access required for impersonation",
      });
    }

    const supabaseAdmin = useSupabaseAdmin();

    const { data: existingWork, error: fetchError } = await supabaseAdmin
      .from("work")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingWork) {
      throw createError({ statusCode: 404, message: "Work not found" });
    }

    if (!isAdmin) {
      const { data: linkData } = await supabaseAdmin
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id)
        .eq("voice_actor_id", (existingWork as any).voice_actor_id)
        .maybeSingle();

      if (!linkData) {
        throw createError({
          statusCode: 403,
          message: "Unauthorized: You can only delete your own work entries",
        });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("work")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting work:", deleteError);
      throw deleteError;
    }

    return {
      success: true,
      message: "Voice actor link deleted successfully",
    };
  } catch (error: any) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in delete-voice-actor-link:", error);
    throw createError({
      statusCode: 500,
      message: error?.message || "Internal server error",
    });
  }
});
