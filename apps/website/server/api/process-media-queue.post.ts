import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import {
  checkMediaDubbingSections,
  checkGameDubbingSections,
  extractMediaDubbingCredits,
  extractGameDubbingCredits,
} from "../utils/services/media-preparation";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { useWikipediaCache, useIgdbClient } from "../utils";
import { extractAvailableLanguages } from "../utils/cache/wikipedia";

export default defineEventHandler(async (event) => {
  const internalSecret = getHeader(event, "x-internal-secret");
  const authHeader = getHeader(event, "authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const config = useRuntimeConfig();
  const secretKey =
    (config.supabaseSecretKey as string) ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NUXT_SUPABASE_SECRET_KEY ||
    "";
  const isInternalTrigger =
    Boolean(secretKey) &&
    ((Boolean(internalSecret) && internalSecret === secretKey) ||
      (Boolean(bearerToken) && bearerToken === secretKey));

  if (!isInternalTrigger) {
    requireAdmin(event);
  }

  try {
    let isSingle = false;
    let isForce = false;
    let targetQueueParam: string | undefined = undefined;

    try {
      const query = getQuery(event);
      if (query.queue && typeof query.queue === "string") {
        targetQueueParam = query.queue.trim().toLowerCase();
      }

      const body = await readBody(event);
      if (body) {
        isSingle = body.single === true;
        isForce = body.force === true;
        if (body.queue && typeof body.queue === "string") {
          targetQueueParam = body.queue.trim().toLowerCase();
        }
      }
    } catch {
      // Ignore body/query parse errors
    }

    // Normalize targetQueueParam strictly (no backward compatibility aliases)
    let specificQueue: "wiki_extract" | "wiki_check" | "wiki_discovery" | null =
      null;
    if (targetQueueParam) {
      if (
        targetQueueParam === "extract" ||
        targetQueueParam === "wiki_extract"
      ) {
        specificQueue = "wiki_extract";
      } else if (
        targetQueueParam === "check" ||
        targetQueueParam === "wiki_check"
      ) {
        specificQueue = "wiki_check";
      } else if (
        targetQueueParam === "discovery" ||
        targetQueueParam === "wiki_discovery"
      ) {
        specificQueue = "wiki_discovery";
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid queue name: ${targetQueueParam}. Must be 'discovery', 'check', or 'extract'.`,
        });
      }
    }

    const supabaseAdmin = useSupabaseAdmin();

    if (!isForce && !isSingle) {
      const { data: lockedCount, error: lockedErr } = await (
        supabaseAdmin as any
      ).rpc("get_media_queue_locked_count", {
        p_queue_name: specificQueue ?? undefined,
      });
      if (lockedErr) {
        console.error("[QUEUE] Failed to check locked count:", lockedErr);
      } else if ((lockedCount as number) > 0) {
        return {
          ok: true,
          processed: 0,
          results: [],
          reason: "already_running",
          lockedCount: Number(lockedCount),
          message: `A queue processor worker is currently active on ${specificQueue ?? "the queue"} (${lockedCount} item(s) locked). Pass {"force": true} to process anyway.`,
        };
      }
    }

    // Step 1: Pop a message based on queue selection / priority order
    let targetQueue: "wiki_extract" | "wiki_check" | "wiki_discovery" =
      specificQueue ?? "wiki_extract";
    let queueRes: any;

    if (specificQueue) {
      queueRes = await supabaseAdmin.rpc("pop_media_queue_message", {
        p_queue_name: specificQueue,
        p_vt_seconds: 90,
      });
    } else {
      // Priority 1: wiki_extract (LLM ready)
      queueRes = await supabaseAdmin.rpc("pop_media_queue_message", {
        p_queue_name: "wiki_extract",
        p_vt_seconds: 90,
      });
      targetQueue = "wiki_extract";

      // Priority 2: wiki_check (TOC regex check)
      if (
        !queueRes.error &&
        (!queueRes.data || (queueRes.data as any[]).length === 0)
      ) {
        queueRes = await supabaseAdmin.rpc("pop_media_queue_message", {
          p_queue_name: "wiki_check",
          p_vt_seconds: 45,
        });
        targetQueue = "wiki_check";
      }

      // Priority 3: wiki_discovery (Wikidata sitelinks)
      if (
        !queueRes.error &&
        (!queueRes.data || (queueRes.data as any[]).length === 0)
      ) {
        queueRes = await supabaseAdmin.rpc("pop_media_queue_message", {
          p_queue_name: "wiki_discovery",
          p_vt_seconds: 45,
        });
        targetQueue = "wiki_discovery";
      }
    }

    const { data: rawQueueItem, error: popError } = queueRes;

    if (popError) {
      console.error(
        `[QUEUE] RPC pop_media_queue_message error on ${targetQueue}:`,
        popError,
      );
      throw new Error(
        `RPC pop_media_queue_message failed for ${targetQueue}: ${JSON.stringify(popError)}`,
      );
    }

    if (!rawQueueItem || (rawQueueItem as any[]).length === 0) {
      console.log(
        `[QUEUE] No pending items in ${specificQueue ?? "any queue"}`,
      );
      return {
        ok: true,
        processed: 0,
        results: [],
        queue: targetQueue,
        reason: "no_pending_items",
        message: `No pending items found in ${specificQueue ?? "any queue"} (items may be locked in visibility timeout or the queue is empty).`,
      };
    }

    const queueItem = Array.isArray(rawQueueItem)
      ? rawQueueItem[0]
      : rawQueueItem;
    const msgId = Number(queueItem.msg_id);
    const payload = queueItem.message as {
      tmdb_id: number;
      media_type: "movie" | "tv" | "season" | "episode" | "video_game";
      season_number?: number;
      episode_number?: number;
      language?: string;
      page_id?: number;
      section_indexes?: number[];
      is_manual?: boolean;
      priority?: "high" | "normal";
    };
    const readCt = Number(queueItem.read_ct);

    console.log(
      `[QUEUE] Popped item ${msgId} from ${targetQueue}: ${payload.media_type} ID ${payload.tmdb_id}${payload.language ? ` [${payload.language}]` : ""}`,
    );

    const results: any[] = [];
    let mediaTitle = "Unknown title";

    // -------------------------------------------------------------------------
    // QUEUE 1: wiki_discovery (Wikidata sitelink discovery & language fan-out)
    // -------------------------------------------------------------------------
    if (targetQueue === "wiki_discovery") {
      try {
        let wikiId: string | undefined = undefined;

        if (payload.media_type === "video_game") {
          const igdbClient = useIgdbClient();
          const game = await igdbClient.getGame(payload.tmdb_id);
          if (!game) throw new Error(`IGDB game ${payload.tmdb_id} not found`);
          mediaTitle = game.name;

          const wikipediaCache = useWikipediaCache();
          const searchData = await wikipediaCache.searchWikidataEntities(
            game.name,
            "en",
          );
          if (searchData?.search?.length > 0) {
            wikiId = searchData.search[0].id;
          }
        } else {
          const tmdbType =
            payload.media_type === "season" || payload.media_type === "episode"
              ? "tv"
              : payload.media_type;

          const config = useRuntimeConfig();
          const response = await fetch(
            `https://api.themoviedb.org/3/${tmdbType}/${payload.tmdb_id}?append_to_response=external_ids`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.tmdbApiKey}`,
                Accept: "application/json",
              },
            },
          );

          if (response.ok) {
            const movie = (await response.json()) as any;
            mediaTitle = movie.title || movie.name || "Unknown title";
            wikiId = movie.external_ids?.wikidata_id;

            if (movie.adult === true) {
              await supabaseAdmin.rpc("archive_media_queue_message", {
                p_queue_name: targetQueue,
                p_msg_id: msgId,
              });

              await sendDiscordAdminNotification(
                "Queue Discovery Skipped (18+ Adult Content)",
                `**${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}) is marked as adult content and was excluded.`,
              );

              return {
                ok: true,
                processed: 1,
                results: [
                  { id: msgId, ok: true, changes: 0, note: "18+ skipped" },
                ],
              };
            }
          }
        }

        if (!wikiId) {
          const errMsg = `No Wikidata ID found for ${payload.media_type} ${payload.tmdb_id}.`;
          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
            p_error: errMsg,
          });

          await sendDiscordAdminNotification(
            "Queue Discovery Skipped",
            `No Wikidata ID found for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}). Discovery archived.`,
          );

          return {
            ok: true,
            processed: 1,
            results: [{ id: msgId, ok: false, error: errMsg }],
          };
        }

        const wikipediaCache = useWikipediaCache();
        const entity = await wikipediaCache.getAllSitelinksEntity(wikiId);
        const sitelinks = entity.entities[wikiId]?.sitelinks;
        const availableLanguages = extractAvailableLanguages(sitelinks);

        console.log(
          `[QUEUE] Discovered ${availableLanguages.length} languages for ${mediaTitle} (ranked by popularity)`,
        );

        if (availableLanguages.length === 0) {
          const wikidataUrl = `https://www.wikidata.org/wiki/${wikiId}`;
          const errMsg = `No Wikipedia sitelinks found on Wikidata (${wikidataUrl}).`;

          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
            p_error: errMsg,
          });

          await sendDiscordAdminNotification(
            "Queue Discovery: No Wikipedia Pages",
            `No Wikipedia pages found for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}).\n\`\`\`\n${errMsg}\n\`\`\`\n🔗 **Wikidata Item:** ${wikidataUrl}`,
            { url: wikidataUrl },
          );

          return {
            ok: true,
            processed: 1,
            results: [{ id: msgId, ok: false, error: errMsg }],
          };
        }

        // Enqueue each language into Queue 2: wiki_check
        let enqueuedCount = 0;
        let alreadyEnqueuedCount = 0;
        for (const lang of availableLanguages) {
          const { error: enqueueError } = await supabaseAdmin.rpc(
            "enqueue_media_fetch",
            {
              p_tmdb_id: payload.tmdb_id,
              p_media_type: payload.media_type,
              p_season_number: payload.season_number ?? undefined,
              p_episode_number: payload.episode_number ?? undefined,
              p_language: lang,
              p_is_manual: payload.is_manual ?? false,
            },
          );

          if (enqueueError) {
            if (enqueueError.message?.includes("already in the")) {
              alreadyEnqueuedCount++;
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

        await supabaseAdmin.rpc("archive_media_queue_message", {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
        });

        results.push({
          id: msgId,
          ok: true,
          changes: 0,
          note: `Enqueued ${enqueuedCount} language checks for ${mediaTitle}`,
        });

        await sendDiscordAdminNotification(
          "Queue Discovery Completed",
          `Discovered **${availableLanguages.length} language(s)** for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}).\n• Enqueued **${enqueuedCount}** new language checks\n• **${alreadyEnqueuedCount}** already pending.`,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[QUEUE] Error in discovery job ${msgId}:`, errMsg);

        await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
          p_error: errMsg,
        });

        results.push({ id: msgId, ok: false, error: errMsg });

        await sendDiscordAdminNotification(
          "Queue Discovery Failed",
          `Discovery failed for **${mediaTitle}** (ID ${payload.tmdb_id}):\n\`\`\`\n${errMsg}\n\`\`\``,
        );
      }

      return {
        ok: true,
        processed: results.length,
        results,
        queue: targetQueue,
      };
    }

    // -------------------------------------------------------------------------
    // QUEUE 2: wiki_check (Instant TOC fetch + regex check -> enqueues to extract)
    // -------------------------------------------------------------------------
    if (targetQueue === "wiki_check") {
      const lang = payload.language || "fr";
      try {
        let checkResult: any;

        if (payload.media_type === "video_game") {
          checkResult = await checkGameDubbingSections({
            igdbId: payload.tmdb_id,
            language: lang,
          });
        } else {
          checkResult = await checkMediaDubbingSections({
            tmdbId: payload.tmdb_id,
            type: payload.media_type as any,
            language: lang,
            seasonNumber: payload.season_number,
            episodeNumber: payload.episode_number,
          });
        }

        if (checkResult.title) {
          mediaTitle = checkResult.title;
        }

        if (checkResult.isAdult) {
          await supabaseAdmin.rpc("archive_media_queue_message", {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
          });

          return {
            ok: true,
            processed: 1,
            results: [{ id: msgId, ok: true, changes: 0, note: "18+ skipped" }],
            queue: targetQueue,
          };
        }

        if (
          !checkResult.ok ||
          !checkResult.sectionIndexes ||
          checkResult.sectionIndexes.length === 0
        ) {
          const errorMsg =
            checkResult.error ||
            `No voice actor / dubbing sections found on Wikipedia: ${checkResult.wikipediaUrl || lang}`;

          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
            p_error: errorMsg,
          });

          results.push({ id: msgId, ok: false, changes: 0, error: errorMsg });

          const wikiUrl = checkResult.wikipediaUrl;
          const wikiSection = wikiUrl
            ? `\n🔗 **Wikipedia Link:** ${wikiUrl}`
            : "";

          await sendDiscordAdminNotification(
            `Queue Check: No Dubbing Section [${lang.toUpperCase()}]`,
            `No dubbing section found for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id} [${lang.toUpperCase()}]):\n\`\`\`\n${errorMsg}\n\`\`\`${wikiSection}`,
            wikiUrl ? { url: wikiUrl } : undefined,
          );

          return { ok: true, processed: 1, results, queue: targetQueue };
        }

        // Section(s) found! Enqueue to Queue 3: wiki_extract
        const { error: extractEnqueueErr } = await (supabaseAdmin as any).rpc(
          "enqueue_media_extract",
          {
            p_tmdb_id: payload.tmdb_id,
            p_media_type: payload.media_type,
            p_language: lang,
            p_page_id: checkResult.pageId,
            p_section_indexes: checkResult.sectionIndexes,
            p_season_number: payload.season_number ?? undefined,
            p_episode_number: payload.episode_number ?? undefined,
            p_is_manual: payload.is_manual ?? false,
          },
        );

        if (
          extractEnqueueErr &&
          !extractEnqueueErr.message?.includes("already in the")
        ) {
          throw new Error(
            `Failed to enqueue to wiki_extract: ${extractEnqueueErr.message}`,
          );
        }

        await supabaseAdmin.rpc("archive_media_queue_message", {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
        });

        results.push({
          id: msgId,
          ok: true,
          changes: 0,
          note: `Found ${checkResult.sectionIndexes.length} section(s). Enqueued to LLM extraction.`,
        });

        console.log(
          `[QUEUE] Check verified for ${mediaTitle} [${lang}]: ${checkResult.sectionIndexes.length} sections enqueued to wiki_extract`,
        );

        const checkWikiUrl = checkResult.wikipediaUrl;
        const checkWikiSection = checkWikiUrl
          ? `\n🔗 **Wikipedia Link:** ${checkWikiUrl}`
          : "";

        await sendDiscordAdminNotification(
          `Dubbing Section Found [${lang.toUpperCase()}]`,
          `Found **${checkResult.sectionIndexes.length} section(s)** on Wikipedia for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id}). Enqueued for LLM credit extraction.${checkWikiSection}`,
          checkWikiUrl
            ? { url: checkWikiUrl, color: 0x57f287 }
            : { color: 0x57f287 },
        );

        return { ok: true, processed: 1, results, queue: targetQueue };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[QUEUE] Error checking sections for message ${msgId}:`,
          errMsg,
        );

        await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
          p_error: errMsg,
        });

        results.push({ id: msgId, ok: false, changes: 0, error: errMsg });

        const wikiUrl = errMsg.match(
          /https:\/\/[a-z0-9\-_.]+\.wikipedia\.org\/wiki\/[^\s)\]]+/i,
        )?.[0];
        const wikiSection = wikiUrl
          ? `\n🔗 **Wikipedia Link:** ${wikiUrl}`
          : "";

        await sendDiscordAdminNotification(
          `Queue Check Failed [${lang.toUpperCase()}]`,
          `Failed to check **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id} [${lang.toUpperCase()}]):\n\`\`\`\n${errMsg}\n\`\`\`${wikiSection}`,
          wikiUrl ? { url: wikiUrl } : undefined,
        );

        return { ok: true, processed: 1, results, queue: targetQueue };
      }
    }

    // -------------------------------------------------------------------------
    // QUEUE 3: wiki_extract (LLM Gemini extraction of verified sections)
    // -------------------------------------------------------------------------
    if (targetQueue === "wiki_extract") {
      const lang = payload.language || "fr";
      try {
        const pageId = payload.page_id;
        const sectionIndexes = payload.section_indexes;

        if (!pageId || !sectionIndexes || !Array.isArray(sectionIndexes)) {
          throw new Error(
            "Missing page_id or section_indexes in wiki_extract payload.",
          );
        }

        let extractResult: any;
        if (payload.media_type === "video_game") {
          extractResult = await extractGameDubbingCredits({
            igdbId: payload.tmdb_id,
            language: lang,
            pageId,
            sectionIndexes,
          });
        } else {
          extractResult = await extractMediaDubbingCredits({
            tmdbId: payload.tmdb_id,
            type: payload.media_type as any,
            language: lang,
            pageId,
            sectionIndexes,
            seasonNumber: payload.season_number,
            episodeNumber: payload.episode_number,
          });
        }

        if (extractResult.title) {
          mediaTitle = extractResult.title;
        }

        if (!extractResult.ok) {
          throw new Error(extractResult.error || "Credit extraction failed");
        }

        await supabaseAdmin.rpc("archive_media_queue_message", {
          p_queue_name: targetQueue,
          p_msg_id: msgId,
        });

        results.push({
          id: msgId,
          ok: true,
          changes: extractResult.changes,
          creditsAdded: extractResult.creditsAdded,
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
          `Queue Item Processed [${lang.toUpperCase()}]`,
          `Successfully processed **${mediaTitle}**${
            payload.season_number ? ` (Season ${payload.season_number})` : ""
          }${
            payload.episode_number ? ` (Episode ${payload.episode_number})` : ""
          } [${lang.toUpperCase()}].\n• Added **${extractResult.creditsAdded ?? 0}** roles\n• Added **${extractResult.changes ?? 0}** new voice actors.`,
          {
            ...(extractResult.imageUrl
              ? { imageUrl: extractResult.imageUrl }
              : {}),
            ...(targetUrl ? { url: targetUrl } : {}),
          },
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[QUEUE] Error extracting credits for message ${msgId}:`,
          errMsg,
        );

        if (errMsg.includes("LLM API Rate Limited (429)")) {
          const MAX_RETRIES = 5;
          if (readCt >= MAX_RETRIES) {
            await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
              p_queue_name: targetQueue,
              p_msg_id: msgId,
              p_error: `Max retries (${MAX_RETRIES}) reached due to LLM 429 rate limit.`,
            });
            results.push({
              id: msgId,
              ok: false,
              changes: 0,
              error: `Max retries (${MAX_RETRIES}) reached`,
            });

            await sendDiscordAdminNotification(
              `Queue Extraction Rate-Limited [${lang.toUpperCase()}]`,
              `Max retries (${MAX_RETRIES}) reached for **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id} [${lang.toUpperCase()}]):\n\`\`\`\n${errMsg}\n\`\`\``,
              { color: 0xed4245 },
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
          await supabaseAdmin.rpc("archive_media_queue_message_with_error", {
            p_queue_name: targetQueue,
            p_msg_id: msgId,
            p_error: errMsg,
          });
          results.push({ id: msgId, ok: false, changes: 0, error: errMsg });

          await sendDiscordAdminNotification(
            `Queue Item Failed [${lang.toUpperCase()}]`,
            `Failed to extract **${mediaTitle}** (${payload.media_type} ${payload.tmdb_id} [${lang.toUpperCase()}]):\n\`\`\`\n${errMsg}\n\`\`\``,
            { color: 0xed4245 },
          );
        }
      }

      const hasFailure = results.some((r) => !r.ok);
      return {
        ok: !hasFailure,
        processed: results.length,
        results,
        queue: targetQueue,
      };
    }

    return { ok: true, processed: 0, results: [], queue: targetQueue };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[QUEUE] Uncaught error in process-media-queue:", errorMsg);

    await sendDiscordAdminNotification(
      "Queue Processor FAILED",
      `Critical failure in process-media-queue: ${errorMsg}`,
    );

    throw createError({
      statusCode: 500,
      statusMessage: "Queue processing failed",
      data: { error: errorMsg },
    });
  }
});
