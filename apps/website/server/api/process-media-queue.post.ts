import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import { prepareMedia, prepareGame } from "../utils/services/media-preparation";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { useWikipediaCache } from "../utils";
import { extractAvailableLanguages } from "../utils/cache/wikipedia";

export default defineEventHandler(async (event) => {
  const internalSecret = getHeader(event, "x-internal-secret");
  const config = useRuntimeConfig();
  const secretKey =
    (config.supabaseSecretKey as string) ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NUXT_SUPABASE_SECRET_KEY ||
    "";
  const isInternalTrigger =
    Boolean(internalSecret) &&
    Boolean(secretKey) &&
    internalSecret === secretKey;

  if (!isInternalTrigger) {
    requireAdmin(event);
  }

  try {
    let isSingle = false;
    let isForce = false;

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

    let targetQueue = "wiki_lang";
    let { data, error: popError } = await supabaseAdmin.rpc(
      "pop_media_queue_message",
      {
        p_queue_name: "wiki_lang",
        p_vt_seconds: 90,
      },
    );

    if (popError) {
      console.error("[QUEUE] Error polling wiki_lang:", popError);
    }

    if (!data || data.length === 0) {
      targetQueue = "wiki_nolang";
      const fallbackRes = await supabaseAdmin.rpc("pop_media_queue_message", {
        p_queue_name: "wiki_nolang",
        p_vt_seconds: 90,
      });
      data = fallbackRes.data;
      popError = fallbackRes.error;
    }

    if (popError) {
      throw new Error(
        `RPC pop_media_queue_message failed for ${targetQueue}: ${JSON.stringify(popError)}`,
      );
    }

    if (!data || data.length === 0) {
      return { ok: true, processed: 0, results: [] };
    }

    const queueItem = data[0]!;
    const msgId = Number(queueItem.msg_id);
    const readCt = Number(queueItem.read_ct ?? 1);
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

            if (tmdbData.adult === true) {
              console.log(
                `[QUEUE] Skipping 18+ adult media ${payload.media_type} ${payload.tmdb_id}: ${mediaTitle}`,
              );

              const { error: archiveErr } = await supabaseAdmin.rpc(
                "archive_media_queue_message",
                {
                  p_queue_name: targetQueue,
                  p_msg_id: msgId,
                },
              );
              if (archiveErr) {
                console.error(
                  `[QUEUE] Failed to archive message ${msgId} in ${targetQueue}:`,
                  archiveErr,
                );
                throw new Error(
                  `Failed to archive message ${msgId}: ${archiveErr.message}`,
                );
              }

              await sendDiscordAdminNotification(
                "Queue Discovery Skipped (18+ Content)",
                `**${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}) is marked as 18+ adult content and was excluded.`,
              );

              return {
                ok: true,
                processed: 1,
                results: [
                  {
                    id: msgId,
                    ok: true,
                    changes: 0,
                    note: "18+ adult content skipped",
                  },
                ],
              };
            }
          }
        }

        if (!wikiId) {
          // For games or if no Wikidata ID found, process without language filtering
          console.log(
            `[QUEUE] No Wikidata ID found for ${payload.media_type} ${payload.tmdb_id}, processing without language filtering`,
          );

          const { error: archiveErr } = await supabaseAdmin.rpc(
            "archive_media_queue_message",
            {
              p_queue_name: targetQueue,
              p_msg_id: msgId,
            },
          );
          if (archiveErr) {
            console.error(
              `[QUEUE] Failed to archive message ${msgId} in ${targetQueue}:`,
              archiveErr,
            );
            throw new Error(
              `Failed to archive message ${msgId}: ${archiveErr.message}`,
            );
          }

          await sendDiscordAdminNotification(
            "Queue Discovery Skipped",
            `No Wikidata ID found for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}). Archived without language expansion.`,
          );

          return {
            ok: true,
            processed: 1,
            results: [
              {
                id: msgId,
                ok: true,
                changes: 0,
                note: "No Wikidata ID found",
              },
            ],
          };
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
          // No Wikipedia pages found on Wikidata, archive with error
          const wikidataUrl = wikiId
            ? `https://www.wikidata.org/wiki/${wikiId}`
            : undefined;
          const errMsg = `No Wikipedia sitelinks found on Wikidata${wikidataUrl ? ` (${wikidataUrl})` : ""}.`;

          const { error: archiveErr } = await supabaseAdmin.rpc(
            "archive_media_queue_message_with_error",
            {
              p_queue_name: targetQueue,
              p_msg_id: msgId,
              p_error: errMsg,
            },
          );
          if (archiveErr) {
            console.error(
              `[QUEUE] Failed to archive message ${msgId} in ${targetQueue}:`,
              archiveErr,
            );
          }

          const wikidataLink = wikidataUrl
            ? `\n🔗 **Wikidata Item:** ${wikidataUrl}`
            : "";

          await sendDiscordAdminNotification(
            "Queue Discovery: No Wikipedia Pages",
            `No Wikipedia pages found for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}).\n\`\`\`\n${errMsg}\n\`\`\`${wikidataLink}`,
            wikidataUrl ? { url: wikidataUrl } : undefined,
          );

          return {
            ok: true,
            processed: 1,
            results: [
              {
                id: msgId,
                ok: false,
                changes: 0,
                error: errMsg,
              },
            ],
          };
        }

        // Enqueue a separate job for each language
        let enqueuedCount = 0;
        let alreadyEnqueuedCount = 0;
        const enqueueErrors: string[] = [];
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
              alreadyEnqueuedCount++;
            } else {
              console.error(
                `[QUEUE] Failed to enqueue language ${lang}:`,
                enqueueError,
              );
              enqueueErrors.push(`${lang}: ${enqueueError.message}`);
            }
          } else {
            enqueuedCount++;
          }
        }

        // Archive the original discovery job
        const { error: archiveErr } = await supabaseAdmin.rpc(
          "archive_media_queue_message",
          {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
          },
        );
        if (archiveErr) {
          console.error(
            `[QUEUE] Failed to archive discovery job ${msgId} in ${targetQueue}:`,
            archiveErr,
          );
          throw new Error(
            `Failed to archive discovery job ${msgId}: ${archiveErr.message}`,
          );
        }

        results.push({
          id: msgId,
          ok: true,
          changes: 0,
          enqueuedLanguages: enqueuedCount,
          alreadyEnqueuedLanguages: alreadyEnqueuedCount,
          totalLanguages: availableLanguages.length,
          errors: enqueueErrors.length > 0 ? enqueueErrors : undefined,
        });

        console.log(
          `[QUEUE] Enqueued ${enqueuedCount}/${availableLanguages.length} language jobs (${alreadyEnqueuedCount} already queued) for ${mediaTitle}`,
        );

        let discoveryUrl: string | undefined = undefined;
        if (payload.media_type === "movie") {
          discoveryUrl = `/movie/${payload.tmdb_id}`;
        } else if (
          payload.media_type === "tv" ||
          payload.media_type === "season" ||
          payload.media_type === "episode"
        ) {
          discoveryUrl = `/serie/${payload.tmdb_id}`;
        } else if (payload.media_type === "video_game") {
          discoveryUrl = `/game/${payload.tmdb_id}`;
        }

        const errorDetails =
          enqueueErrors.length > 0
            ? `\n⚠️ **Enqueue Errors:**\n\`\`\`\n${enqueueErrors.join("\n")}\n\`\`\``
            : "";

        const statusSummary =
          alreadyEnqueuedCount > 0
            ? `• Enqueued **${enqueuedCount}** new language job(s) (${alreadyEnqueuedCount} already queued): ${availableLanguages.map((l: string) => `\`${l.toUpperCase()}\``).join(", ")}.`
            : `• Enqueued **${enqueuedCount}** language job(s): ${availableLanguages.map((l: string) => `\`${l.toUpperCase()}\``).join(", ")}.`;

        await sendDiscordAdminNotification(
          "Queue Discovery Completed",
          `Discovered **${availableLanguages.length} language(s)** for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}).\n${statusSummary}${errorDetails}`,
          {
            ...(discoveryUrl ? { url: discoveryUrl } : {}),
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

        console.error(`[QUEUE] Error in discovery job ${msgId}:`, errMsg);

        await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
          p_queue_name: targetQueue,
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
          "Queue Discovery Failed",
          `Discovery failed for **${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type}** (ID ${payload.tmdb_id}):\n\`\`\`\n${errMsg}\n\`\`\``,
        );
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
        const errObj: any = new Error(errorInfo);
        if (responseData?.wikipediaUrl) {
          errObj.wikipediaUrl = responseData.wikipediaUrl;
        }
        throw errObj;
      }

      const { error: archiveErr } = await supabaseAdmin.rpc(
        "archive_media_queue_message",
        {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
        },
      );
      if (archiveErr) {
        console.error(
          `[QUEUE] Failed to archive language job ${msgId} in ${targetQueue}:`,
          archiveErr,
        );
        throw new Error(
          `Failed to archive language job ${msgId}: ${archiveErr.message}`,
        );
      }

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

      const langTag = payload.language
        ? ` [${payload.language.toUpperCase()}]`
        : "";
      await sendDiscordAdminNotification(
        `Queue Item Processed${langTag}`,
        `Successfully processed **${mediaTitle}**${
          payload.season_number ? ` (Season ${payload.season_number})` : ""
        }${
          payload.episode_number ? ` (Episode ${payload.episode_number})` : ""
        }${payload.language ? ` [${payload.language.toUpperCase()}]` : ""}.\n• Added **${responseData.creditsAdded ?? 0}** roles\n• Added **${responseData.changes ?? 0}** new voice actors.`,
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

      const wikiUrl =
        (err as any)?.wikipediaUrl ||
        errMsg.match(
          /https:\/\/[a-z0-9\-_.]+\.wikipedia\.org\/wiki\/[^\s)\]]+/i,
        )?.[0];
      const wikiLinkSection = wikiUrl
        ? `\n🔗 **Wikipedia Link:** ${wikiUrl}`
        : "";

      const langTag = payload.language
        ? ` [${payload.language.toUpperCase()}]`
        : "";

      if (errMsg.includes("LLM API Rate Limited (429)")) {
        const MAX_RETRIES = 5;

        if (readCt >= MAX_RETRIES) {
          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_queue_name: targetQueue,
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
            `Queue Item Failed (Rate Limit)${langTag}`,
            `Failed to process **${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type}** (ID ${payload.tmdb_id}${payload.language ? `, language: ${payload.language.toUpperCase()}` : ""}): Max retries (${MAX_RETRIES}) reached due to LLM rate limit.\n\`\`\`\n${errMsg}\n\`\`\`${wikiLinkSection}`,
            wikiUrl ? { url: wikiUrl } : undefined,
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
          p_queue_name: targetQueue,
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
          `Queue Item Failed${langTag}`,
          `Failed to process **${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type}** (ID ${payload.tmdb_id}${payload.language ? `, language: ${payload.language.toUpperCase()}` : ""}):\n\`\`\`\n${errMsg}\n\`\`\`${wikiLinkSection}`,
          wikiUrl ? { url: wikiUrl } : undefined,
        );
      }
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
