import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { action, mediaType, mediaId, tmdbId, seasonNumber, episodeNumber } =
    body;

  if (!action || !mediaType) {
    throw createError({
      statusCode: 400,
      message: "Missing required parameters",
    });
  }

  const supabaseAdmin = useSupabaseAdmin();

  if (action === "status") {
    const { data, error } = await supabaseAdmin.rpc("get_media_queue_status", {
      p_media_type: mediaType,
      p_tmdb_id: tmdbId || mediaId,
      p_season_number: seasonNumber,
      p_episode_number: episodeNumber,
    });

    if (error) throw error;
    return { data };
  } else if (action === "enqueue") {
    const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
      p_media_type: mediaType,
      p_tmdb_id: tmdbId || mediaId,
      p_season_number: seasonNumber,
      p_episode_number: episodeNumber,
    });

    if (error) throw error;
    return { success: true };
  }

  throw createError({ statusCode: 400, message: "Invalid action" });
});
