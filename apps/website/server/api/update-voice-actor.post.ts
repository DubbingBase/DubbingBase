import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const body = await readBody(event);
  const { voice_actor_id, updates, targetUserId } = body;

  if (!voice_actor_id) {
    throw createError({
      statusCode: 400,
      message: "voice_actor_id is required",
    });
  }

  const isAdmin =
    user.app_metadata?.role === "admin" ||
    user.user_metadata?.role === "admin" ||
    (user as any).role === "admin";

  const supabaseAdmin = useSupabaseAdmin();

  if (!isAdmin) {
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from("user_voice_actor_links")
      .select("voice_actor_id")
      .eq("user_id", user.id)
      .eq("voice_actor_id", voice_actor_id)
      .maybeSingle();

    if (linkError || !linkData) {
      throw createError({
        statusCode: 403,
        message: "Unauthorized to update this voice actor",
      });
    }
  }

  const updateData: any = { ...updates };
  updateData.updated_at = new Date().toISOString();

  if (updateData.date_of_birth === "") {
    updateData.date_of_birth = null;
  }

  if (
    typeof updateData.profile_picture === "string" &&
    updateData.profile_picture.startsWith("http")
  ) {
    const config = useRuntimeConfig();
    const supabaseUrl = config.supabaseUrl || "127.0.0.1";
    if (
      !updateData.profile_picture.includes(supabaseUrl) &&
      !updateData.profile_picture.includes("supabase.co")
    ) {
      try {
        const imgRes = await fetch(updateData.profile_picture);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();

          const ext =
            updateData.profile_picture.split(".").pop()?.split("?")[0] || "jpg";
          const path = `${voice_actor_id}-${Date.now()}.${ext}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("voice_actor_profile_pictures")
            .upload(path, arrayBuffer, {
              contentType: imgRes.headers.get("content-type") || "image/jpeg",
              upsert: true,
            });

          if (!uploadError) {
            updateData.profile_picture = path;
          } else {
            console.error("Failed to upload image to storage:", uploadError);
          }
        }
      } catch (e) {
        console.error("Error downloading external image:", e);
      }
    }
  }

  const { data: voiceActorData, error: vaError } = await supabaseAdmin
    .from("voice_actors")
    .update(updateData)
    .eq("id", voice_actor_id)
    .select()
    .single();

  if (vaError) {
    console.error("Error updating voice actor:", vaError);
    throw createError({
      statusCode: 500,
      message: "Failed to update voice actor",
    });
  }

  return { profile: voiceActorData };
});
