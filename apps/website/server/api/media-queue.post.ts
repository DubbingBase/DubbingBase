import { useSupabaseAdmin } from "../utils/db/client";
import { sendDiscordAdminNotification } from "../utils/notifications/discord";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const {
    action,
    mediaType,
    mediaId,
    tmdbId,
    seasonNumber,
    episodeNumber,
    language,
  } = body;

  if (!action || !mediaType) {
    throw createError({
      statusCode: 400,
      message: "Missing required parameters",
    });
  }

  const supabaseAdmin = useSupabaseAdmin();
  const targetId = tmdbId || mediaId;

  if (action === "status") {
    const { data, error } = await supabaseAdmin.rpc("get_media_queue_status", {
      p_media_type: mediaType,
      p_tmdb_id: targetId,
      p_season_number: seasonNumber,
      p_episode_number: episodeNumber,
    });

    if (error) throw error;
    return { data };
  } else if (action === "enqueue") {
    if (
      mediaType === "movie" ||
      mediaType === "tv" ||
      mediaType === "season" ||
      mediaType === "episode"
    ) {
      const config = useRuntimeConfig();
      if (config.tmdbApiKey) {
        const tmdbType =
          mediaType === "season" || mediaType === "episode" ? "tv" : mediaType;
        const res = await fetch(
          `https://api.themoviedb.org/3/${tmdbType}/${targetId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.tmdbApiKey}`,
              Accept: "application/json",
            },
          },
        ).catch(() => null);
        if (res?.ok) {
          const item = await res.json().catch(() => null);
          if (item?.adult === true) {
            throw createError({
              statusCode: 400,
              message: "18+ adult content cannot be enqueued.",
            });
          }
        }
      }
    }

    const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
      p_media_type: mediaType,
      p_tmdb_id: targetId,
      p_season_number: seasonNumber,
      p_episode_number: episodeNumber,
      p_language: language || undefined,
    });

    if (error) throw error;

    const langTag = language ? ` [${String(language).toUpperCase()}]` : "";
    await sendDiscordAdminNotification(
      `Media Enqueued${langTag}`,
      `Enqueued **${mediaType}** (ID: ${targetId})${
        seasonNumber ? ` Season ${seasonNumber}` : ""
      }${episodeNumber ? ` Episode ${episodeNumber}` : ""}${
        language
          ? ` for language **${language}**`
          : " for all-languages discovery"
      }.`,
    );

    return { success: true };
  }

  throw createError({ statusCode: 400, message: "Invalid action" });
});
