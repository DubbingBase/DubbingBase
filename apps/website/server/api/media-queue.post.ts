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
  const rawTargetId = tmdbId || mediaId;
  const targetId = parseInt(String(rawTargetId), 10);

  if (isNaN(targetId)) {
    throw createError({
      statusCode: 400,
      message: `Invalid mediaId: ${rawTargetId}`,
    });
  }

  const numSeason =
    seasonNumber !== undefined &&
    seasonNumber !== null &&
    !isNaN(Number(seasonNumber))
      ? parseInt(String(seasonNumber), 10)
      : undefined;

  const numEpisode =
    episodeNumber !== undefined &&
    episodeNumber !== null &&
    !isNaN(Number(episodeNumber))
      ? parseInt(String(episodeNumber), 10)
      : undefined;

  const cleanLang =
    language && String(language).trim() ? String(language).trim() : undefined;

  if (action === "status") {
    const { data, error } = await supabaseAdmin.rpc("get_media_queue_status", {
      p_media_type: mediaType,
      p_tmdb_id: targetId,
      p_season_number: numSeason,
      p_episode_number: numEpisode,
      p_language: cleanLang,
    });

    if (error) {
      throw createError({
        statusCode: 400,
        message: error.message || "Failed to get queue status",
      });
    }
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
      p_season_number: numSeason,
      p_episode_number: numEpisode,
      p_language: cleanLang,
    });

    if (error) {
      if (error.message && error.message.includes("already in the")) {
        return {
          success: true,
          alreadyQueued: true,
          message: error.message,
        };
      }
      throw createError({
        statusCode: 400,
        message: error.message || "Failed to enqueue media",
      });
    }

    const langTag = cleanLang ? ` [${cleanLang.toUpperCase()}]` : "";
    await sendDiscordAdminNotification(
      `Media Enqueued (Manual)${langTag}`,
      `Enqueued **${mediaType}** (ID: ${targetId})${
        numSeason ? ` Season ${numSeason}` : ""
      }${numEpisode ? ` Episode ${numEpisode}` : ""}${
        cleanLang
          ? ` for language **${cleanLang}**`
          : " for all-languages discovery"
      }.`,
      { color: 0x5865f2 },
    );

    return { success: true, alreadyQueued: false };
  }

  throw createError({ statusCode: 400, message: "Invalid action" });
});
