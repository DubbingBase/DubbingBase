export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const isAdmin =
    user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized: Admin access required",
    });
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

  const supabaseAdmin = event.context.supabaseAdmin;
  if (!supabaseAdmin) {
    throw createError({
      statusCode: 500,
      message: "Server configuration error",
    });
  }

  const { data: voiceActor, error: vaError } = await supabaseAdmin
    .from("voice_actors")
    .select("id")
    .eq("id", voice_actor_id)
    .single();

  if (vaError || !voiceActor) {
    throw createError({ statusCode: 404, message: "Voice actor not found" });
  }

  const { data: existingLink, error: checkError } = await supabaseAdmin
    .from("user_voice_actor_links")
    .select("id")
    .eq("user_id", user_id)
    .eq("voice_actor_id", voice_actor_id)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("Error checking existing link:", checkError);
    throw createError({
      statusCode: 500,
      message: "Failed to check existing link",
    });
  }

  if (existingLink) {
    throw createError({
      statusCode: 400,
      message: "User is already linked to this voice actor",
    });
  }

  const { error: insertError } = await supabaseAdmin
    .from("user_voice_actor_links")
    .insert({ user_id, voice_actor_id });

  if (insertError) {
    console.error("Error linking user to voice actor:", insertError);
    throw createError({
      statusCode: 500,
      message: "Failed to link user to voice actor",
    });
  }

  return {
    success: true,
    message: "User linked to voice actor successfully",
  };
});
