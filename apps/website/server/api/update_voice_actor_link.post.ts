import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const body = await readBody(event);
  const { work_id, performance, targetUserId } = body;

  if (!work_id || !performance) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: work_id and performance are required",
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
    .eq("id", work_id)
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
        message: "Unauthorized: You can only update your own work entries",
      });
    }
  }

  const { data: updatedWork, error: updateError } = await supabaseAdmin
    .from("work")
    .update({ performance })
    .eq("id", work_id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating work:", updateError);
    throw createError({ statusCode: 500, message: updateError.message });
  }

  return updatedWork;
});
