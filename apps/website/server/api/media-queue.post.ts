import { requireDubbingLanguage } from "../utils/dubbing-language";
import { isWikipediaLanguage } from "@app/shared-logic";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireUser } from "../utils/auth";
import { sendDiscordAdminNotification } from "../utils/notifications/discord";
export default defineEventHandler(async (event) => {
  // ponytail: queue responses must never be edge-cached
  const body = await readBody(event);
  const {
    action,
    mediaType,
    mediaId,
    tmdbId,
    seasonNumber,
    episodeNumber,
    language: legacyWikipediaLanguage,
    wikipedia_language,
    dubbing_language,
  } = body;

  if (!action || !mediaType) {
    throw createError({
      statusCode: 400,
      message: "Missing required parameters",
    });
  }

  const requestingUser = action === "enqueue" ? requireUser(event) : null;

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
    seasonNumber !== undefined && seasonNumber !== null && !isNaN(Number(seasonNumber))
      ? parseInt(String(seasonNumber), 10)
      : undefined;

  const numEpisode =
    episodeNumber !== undefined && episodeNumber !== null && !isNaN(Number(episodeNumber))
      ? parseInt(String(episodeNumber), 10)
      : undefined;

  // Deprecated `language` remains an alias for Wikipedia source edition only.
  const rawWikipediaLanguage = wikipedia_language ?? legacyWikipediaLanguage;
  const wikipediaLanguage =
    typeof rawWikipediaLanguage === "string" && rawWikipediaLanguage.length > 0
      ? rawWikipediaLanguage
      : undefined;
  if (wikipediaLanguage && !isWikipediaLanguage(wikipediaLanguage)) {
    throw createError({
      statusCode: 400,
      message: "Invalid Wikipedia source language",
    });
  }
  const dubbingLanguage =
    dubbing_language == null ? undefined : requireDubbingLanguage(dubbing_language);

  if (action === "status") {
    const { data, error } = await supabaseAdmin.rpc("get_media_queue_status", {
      p_media_type: mediaType,
      p_tmdb_id: targetId,
      p_season_number: numSeason,
      p_episode_number: numEpisode,
      p_language: wikipediaLanguage,
      p_wikipedia_language: wikipediaLanguage,
      p_dubbing_language: dubbingLanguage,
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
        const tmdbType = mediaType === "season" || mediaType === "episode" ? "tv" : mediaType;
        const res = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${targetId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.tmdbApiKey}`,
            Accept: "application/json",
          },
        }).catch(() => null);
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
      p_language: wikipediaLanguage,
      p_wikipedia_language: wikipediaLanguage,
      p_dubbing_language: dubbingLanguage,
      p_is_manual: true,
      p_requested_by: requestingUser?.id,
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

    const langTag = wikipediaLanguage ? ` [${wikipediaLanguage.toUpperCase()}]` : "";
    await sendDiscordAdminNotification(
      `Media Enqueued (Manual)${langTag}`,
      `Enqueued **${mediaType}** (ID: ${targetId})${
        numSeason ? ` Season ${numSeason}` : ""
      }${numEpisode ? ` Episode ${numEpisode}` : ""}${
        wikipediaLanguage
          ? ` for Wikipedia source **${wikipediaLanguage}**`
          : " for all-languages discovery"
      }.`,
      {
        queue: wikipediaLanguage ? "wiki_check" : "wiki_discovery",
        color: 0x5865f2,
      },
    );

    return { success: true, alreadyQueued: false };
  }

  throw createError({ statusCode: 400, message: "Invalid action" });
});
