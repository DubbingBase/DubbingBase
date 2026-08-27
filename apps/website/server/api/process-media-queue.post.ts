import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import { prepareMedia, prepareGame } from "../utils/services/media-preparation";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { useWikipediaCache } from "../utils";
import { extractAvailableLanguages } from "../utils/cache/wikipedia";

export default defineEventHandler(async (event) => {
  const internalSecret = getHeader(event, "x-internal-secret");
  const config = useRuntimeConfig();
  const isInternalTrigger =
    Boolean(internalSecret) && internalSecret === config.supabaseSecretKey;

  if (!isInternalTrigger) {
    requireAdmin(event);
  }

  try {
    let isSingle = false;
    let isForce = false;
    let isRateLimited = false;

    try {
      const body = await readBody(event);
      isSingle = body?.single === true;
      isForce = body?.force === true;
    } catch {
      // Ignore parse errors
    }

    const supabaseAdmin = useSupabaseAdmin();

    if (!isForce && !isSingle) {
      const { data: lockedCount, error: lockedErr } = await supabaseAdmin.rpc(
        "get_media_queue_locked_count",
      );
      if (lockedErr) {
        console.error("[QUEUE] Failed to check locked count:", lockedErr);
      } else if ((lockedCount as number) > 0) {
        return {
          ok: true,
          processed: 0,
          results: [],
          reason: "already_running",
        };
      }
    }

    const { data, error: popError } = await supabaseAdmin.rpc(
      "pop_media_queue_message",
      {
        p_vt_seconds: 60,
      },
    );

    if (popError) {
      throw new Error(
        `RPC pop_media_queue_message failed: ${JSON.stringify(popError)}`,
      );
    }

    if (!data || data.length === 0) {
      return { ok: true, processed: 0, results: [] };
    }

    const queueItem = data[0]!;
    const msgId = Number(queueItem.msg_id);
    const payload = queueItem.message as {
      tmdb_id: number;
      media_type: string;
      season_number?: number | null;
      episode_number?: number | null;
      language?: string | null;
    } | null;

    if (!payload) {
      throw new Error("Message payload is null or invalid");
    }

    let mediaTitle = "Unknown title";
    const results: any[] = [];

    // If no language specified, this is a discovery job
    // Discover languages and enqueue each one as a separate job
    if (!payload.language) {
      try {
        const config = useRuntimeConfig();
        const tmdbType =
          payload.media_type === "season" || payload.media_type === "episode"
            ? "tv"
            : payload.media_type;

        // Fetch TMDB data to get Wikidata ID
        const tmdbUrl =
          tmdbType === "video_game"
            ? null // Games use IGDB, handled differently
            : `https://api.themoviedb.org/3/${tmdbType}/${payload.tmdb_id}?append_to_response=external_ids`;

        let wikiId: string | null = null;

        if (tmdbUrl) {
          const tmdbResponse = await fetch(tmdbUrl, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.tmdbApiKey}`,
              Accept: "application/json",
            },
          });

          if (tmdbResponse.ok) {
            const tmdbData = (await tmdbResponse.json()) as any;
            mediaTitle = tmdbData.title || tmdbData.name || "Unknown title";
            wikiId = tmdbData.external_ids?.wikidata_id || null;
          }
        }

        if (!wikiId) {
          // For games or if no Wikidata ID found, process without language filtering
          // This maintains backward compatibility
          console.log(
            `[QUEUE] No Wikidata ID found for ${payload.media_type} ${payload.tmdb_id}, processing without language filtering`,
          );

          await supabaseAdmin.rpc("archive_media_queue_message", {
            p_msg_id: msgId,
          });

          results.push({
            id: msgId,
            ok: true,
            changes: 0,
            note: "Processed without language filtering (no Wikidata ID)",
          });

          return { ok: true, processed: results.length, results };
        }

        // Discover available languages from Wikidata sitelinks
        const wikipediaCache = useWikipediaCache();
        const entity = await wikipediaCache.getAllSitelinksEntity(wikiId);
        const sitelinks = entity.entities[wikiId]?.sitelinks;
        const availableLanguages = extractAvailableLanguages(sitelinks);

        console.log(
          `[QUEUE] Discovered ${availableLanguages.length} languages for ${mediaTitle}`,
        );

        if (availableLanguages.length === 0) {
          // No Wikipedia pages found, archive the job
          await supabaseAdmin.rpc("archive_media_queue_message", {
            p_msg_id: msgId,
          });

          results.push({
            id: msgId,
            ok: true,
            changes: 0,
            note: "No Wikipedia pages found",
          });

          return { ok: true, processed: results.length, results };
        }

        // Enqueue a separate job for each language
        let enqueuedCount = 0;
        for (const lang of availableLanguages) {
          const { error: enqueueError } = await supabaseAdmin.rpc(
            "enqueue_media_fetch",
            {
              p_tmdb_id: payload.tmdb_id,
              p_media_type: payload.media_type,
              p_season_number: payload.season_number ?? undefined,
              p_episode_number: payload.episode_number ?? undefined,
              p_language: lang,
            },
          );

          if (enqueueError) {
            if (enqueueError.message?.includes("already in the queue")) {
              console.log(
                `[QUEUE] Language ${lang} already enqueued, skipping`,
              );
            } else {
              console.error(
                `[QUEUE] Failed to enqueue language ${lang}:`,
                enqueueError,
              );
            }
          } else {
            enqueuedCount++;
          }
        }

        // Archive the original discovery job
        await supabaseAdmin.rpc("archive_media_queue_message", {
          p_msg_id: msgId,
        });

        results.push({
          id: msgId,
          ok: true,
          changes: 0,
          enqueuedLanguages: enqueuedCount,
          totalLanguages: availableLanguages.length,
        });

        console.log(
          `[QUEUE] Enqueued ${enqueuedCount} language jobs for ${mediaTitle}`,
        );
      } catch (err) {
        let errMsg = "";
        if (err instanceof Error) {
          errMsg = err.message;
        } else if (typeof err === "object" && err !== null) {
          try {
            errMsg = (err as any).message || JSON.stringify(err);
          } catch {
            errMsg = String(err);
          }
        } else {
          errMsg = String(err);
        }

        console.error(`[QUEUE] Error in discovery job ${msgId}:`, errMsg);

        await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
          p_msg_id: msgId,
          p_error: errMsg,
        });

        results.push({
          id: msgId,
          ok: false,
          changes: 0,
          error: errMsg,
        });
      }

      return { ok: true, processed: results.length, results };
    }

    // Language-specific job: process only the specified language
    try {
      let responseData: any;

      if (payload.media_type === "video_game") {
        responseData = await prepareGame({
          igdbId: payload.tmdb_id,
          language: payload.language,
        });
      } else {
        responseData = await prepareMedia({
          tmdbId: payload.tmdb_id,
          type: payload.media_type as any,
          seasonNumber: payload.season_number,
          episodeNumber: payload.episode_number,
          language: payload.language,
        });
      }

      if (responseData && responseData.title) {
        mediaTitle = responseData.title;
      }

      if (!responseData || !responseData.ok) {
        const errorInfo = responseData?.error || "Unknown preparation error";
        throw new Error(errorInfo);
      }

      await supabaseAdmin.rpc("archive_media_queue_message", {
        p_msg_id: msgId,
      });

      results.push({
        id: msgId,
        ok: true,
        changes: responseData.changes ?? 0,
        error: null,
      });

      let targetUrl: string | undefined = undefined;
      if (payload.media_type === "movie") {
        targetUrl = `/movie/${payload.tmdb_id}`;
      } else if (payload.media_type === "tv") {
        if (payload.season_number && payload.episode_number) {
          targetUrl = `/serie/${payload.tmdb_id}/season/${payload.season_number}/details/${payload.episode_number}`;
        } else if (payload.season_number) {
          targetUrl = `/serie/${payload.tmdb_id}/season/${payload.season_number}`;
        } else {
          targetUrl = `/serie/${payload.tmdb_id}`;
        }
      } else if (payload.media_type === "video_game") {
        targetUrl = `/game/${payload.tmdb_id}`;
      }

      await sendDiscordAdminNotification(
        "Queue Item Processed",
        `Successfully processed ${mediaTitle}${
          payload.season_number ? ` (Season ${payload.season_number})` : ""
        }${
          payload.episode_number ? ` (Episode ${payload.episode_number})` : ""
        }. Added ${responseData.creditsAdded ?? 0} roles and ${responseData.changes ?? 0} new voice actors.`,
        {
          ...(responseData.imageUrl ? { imageUrl: responseData.imageUrl } : {}),
          ...(targetUrl ? { url: targetUrl } : {}),
        },
      );
    } catch (err) {
      let errMsg = "";
      if (err instanceof Error) {
        errMsg = err.message;
      } else if (typeof err === "object" && err !== null) {
        try {
          errMsg = (err as any).message || JSON.stringify(err);
        } catch {
          errMsg = String(err);
        }
      } else {
        errMsg = String(err);
      }

      if (errMsg.includes("LLM API Rate Limited (429)")) {
        isRateLimited = true;

        const readCt = Number(queueItem.read_ct);
        const MAX_RETRIES = 5;

        if (readCt >= MAX_RETRIES) {
          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_msg_id: msgId,
            p_error: `Max retries (${MAX_RETRIES}) reached due to LLM API Rate Limited (429).`,
          });

          results.push({
            id: msgId,
            ok: false,
            changes: 0,
            error: `Max retries (${MAX_RETRIES}) reached due to LLM 429`,
          });

          await sendDiscordAdminNotification(
            "Queue Item Failed (Rate Limit)",
            `Failed to process ${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type} (TMDB ID ${payload.tmdb_id}): Max retries reached due to rate limit.`,
          );
        } else {
          results.push({
            id: msgId,
            ok: false,
            changes: 0,
            error: errMsg,
            rate_limited: true,
          });
        }
      } else {
        console.error(`[QUEUE] Error processing message ID ${msgId}:`, errMsg);

        await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
          p_msg_id: msgId,
          p_error: errMsg,
        });

        results.push({
          id: msgId,
          ok: false,
          changes: 0,
          error: errMsg,
        });

        await sendDiscordAdminNotification(
          "Queue Item Failed",
          `Failed to process ${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type} (TMDB ID ${payload.tmdb_id}): ${errMsg}`,
        );
      }
    }

    if (isRateLimited) {
      console.warn(
        `[QUEUE] Rate limited by LLM. Halting queue processor self-trigger.`,
      );
    } else if (!isSingle) {
      const { data: queueDepth } = await supabaseAdmin.rpc(
        "get_media_queue_depth",
      );

      if (queueDepth && (queueDepth as number) > 0) {
        console.log(
          `[QUEUE] ${queueDepth} more item(s) in queue, self-triggering another invocation.`,
        );
        try {
          const requestUrl = getRequestURL(event);
          const selfUrl = `${requestUrl.origin}/api/process-media-queue`;

          fetch(selfUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": (config.supabaseSecretKey as string) || "",
            },
            body: JSON.stringify({ force: true }),
          })
            .then(() => {
              console.log(`[QUEUE] Self-trigger fetch completed successfully.`);
            })
            .catch((err: any) => {
              console.error(
                "[QUEUE] Failed to self-trigger next invocation:",
                err,
              );
            });
        } catch (urlErr) {
          console.warn(
            "[QUEUE] Could not determine origin for self-trigger:",
            urlErr,
          );
        }
      } else {
        console.log(`[QUEUE] queueDepth is 0 or invalid. Stopping loop.`);
      }
    } else {
      console.log(`[QUEUE] Single mode enabled. Skipping self-trigger.`);
    }

    return { ok: true, processed: results.length, results };
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? (error as any).message || JSON.stringify(error)
          : String(error);
    console.error("[QUEUE] Uncaught error in process-media-queue:", errorMsg);

    await sendDiscordAdminNotification(
      "Queue Processor FAILED",
      `Critical failure in process-media-queue: ${errorMsg}`,
    );

    throw createError({ statusCode: 500, message: errorMsg });
  }
});
