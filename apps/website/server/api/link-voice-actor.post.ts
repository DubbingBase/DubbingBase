import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { findOrCreateDubbingProject } from "../utils/db/dubbing-project";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const body = await readBody(event);
  const {
    voice_actor_id,
    media_type,
    media_id,
    character_name,
    performance,
    targetUserId,
    actor_id,
    language,
  } = body;

  if (!voice_actor_id || !media_type || !media_id || !actor_id || !language) {
    throw createError({
      statusCode: 400,
      message:
        "Missing required fields: actor_id, voice_actor_id, media_type, media_id, and language are required",
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

  const validMediaTypes = ["movie", "tv"];
  if (!validMediaTypes.includes(media_type)) {
    throw createError({
      statusCode: 400,
      message: "Invalid media_type. Must be one of: movie, tv",
    });
  }

  const supabaseAdmin = useSupabaseAdmin();

  const { data: voiceActor, error: voiceActorError } = await supabaseAdmin
    .from("voice_actors")
    .select("*")
    .eq("id", voice_actor_id)
    .single();

  if (voiceActorError || !voiceActor) {
    throw createError({ statusCode: 404, message: "Voice actor not found" });
  }

  const dubbing_project_id = await findOrCreateDubbingProject(
    media_id,
    media_type,
    language,
  );

  let query = supabaseAdmin
    .from("work")
    .select("*")
    .eq("voice_actor_id", voice_actor_id)
    .eq("dubbing_project_id", dubbing_project_id);

  if (actor_id) {
    query = query.eq("actor_id", actor_id);
  } else {
    query = query.is("actor_id", null);
  }

  const { data: existingLink, error: linkCheckError } =
    await query.maybeSingle();

  if (linkCheckError) {
    console.error("Error checking for existing link:", linkCheckError);
    throw createError({ statusCode: 500, message: linkCheckError.message });
  }

  let result;

  if (existingLink) {
    result = existingLink;
  } else {
    const insertData = {
      voice_actor_id,
      character_name: character_name || null,
      performance: performance || "dialogues",
      status: "user",
      actor_id: actor_id || null,
      dubbing_project_id,
    };

    const { data, error } = await supabaseAdmin
      .from("work")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    result = data;
  }

  const { data: voiceActorDetails, error: detailsError } = await supabaseAdmin
    .from("voice_actors")
    .select("*")
    .eq("id", voice_actor_id)
    .single();

  if (detailsError) throw detailsError;

  return {
    ...(result as any),
    voiceActorDetails,
  };
});
