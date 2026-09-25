export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const user_id = body.user_id || body.targetUserId || user.id;
  const voice_actor_id = body.voice_actor_id;

  if (!user_id || !voice_actor_id) {
    throw createError({
      statusCode: 400,
      message: "Missing user_id or voice_actor_id",
    });
  }

  const isAdmin = user.app_metadata?.role === "admin";
  if (user_id !== user.id && !isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized: Admin access required for impersonation",
    });
  }

  const supabaseAdmin = event.context.supabaseAdmin;
  if (!supabaseAdmin) {
    throw createError({
      statusCode: 500,
      message: "Server configuration error",
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("user_voice_actor_links")
    .delete()
    .eq("user_id", user_id)
    .eq("voice_actor_id", voice_actor_id);

  if (deleteError) {
    console.error("Error unlinking user from voice actor:", deleteError);
    throw createError({
      statusCode: 500,
      message: "Failed to unlink user from voice actor",
    });
  }

  return {
    success: true,
    message: "User unlinked from voice actor successfully",
  };
});
