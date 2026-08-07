import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { sendOneSignalNotification } from "../_shared/onesignal.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: ["secret", "user"] },
    async (req, ctx) => {
      try {
        console.log(
          `[QUEUE] Function booted. Processing request... method=${req.method}`,
        );
        const results = [];
        let isSingle = false;
        let isForce = false;
        let isRateLimited = false;

        try {
          // Read request body to check for "single" mode
          if (req.method !== "GET" && req.method !== "HEAD") {
            const bodyText = await req.text();
            if (bodyText) {
              const reqBody = JSON.parse(bodyText);
              isSingle = reqBody?.single === true;
              isForce = reqBody?.force === true;
            }
          }
        } catch (e) {
          console.warn(`[QUEUE] Could not parse request body:`, e);
          // Ignore parse errors
        }

        console.log(
          `[QUEUE] Request config: isSingle=${isSingle}, isForce=${isForce}`,
        );

        // Watchdog mode: if not explicitly forced or single, ensure no other worker is currently running
        if (!isForce && !isSingle) {
          console.log(`[QUEUE] Checking watchdog status...`);
          const { data: lockedCount, error: lockedErr } =
            await ctx.supabaseAdmin.rpc("get_media_queue_locked_count");
          if (lockedErr) {
            console.error("[QUEUE] Failed to check locked count:", lockedErr);
          } else if ((lockedCount as number) > 0) {
            console.log(
              `[QUEUE] Watchdog: ${lockedCount} item(s) are already locked/processing. Exiting to prevent concurrent workers.`,
            );
            return Response.json({
              ok: true,
              processed: 0,
              results: [],
              reason: "already_running",
            });
          }
        }

        // Process exactly 1 item per invocation to guarantee we never hit function timeouts
        console.log(`[QUEUE] Popping next message from queue...`);
        const { data, error: popError } = await ctx.supabaseAdmin.rpc(
          "pop_media_queue_message",
          {
            p_vt_seconds: 60, // Lock the message for 60 seconds during processing
          },
        );

        if (popError) {
          throw new Error(
            `RPC pop_media_queue_message failed: ${JSON.stringify(popError)}`,
          );
        }

        // If no message is returned, queue is empty
        if (!data || data.length === 0) {
          console.log(`[QUEUE] Queue is empty. Exiting normally.`);
          return Response.json({ ok: true, processed: 0, results: [] });
        }

        const queueItem = data[0];
        const msgId = Number(queueItem.msg_id);
        const payload = queueItem.message as {
          tmdb_id: number;
          media_type: string;
          season_number?: number | null;
          episode_number?: number | null;
        } | null;

        if (!payload) {
          throw new Error("Message payload is null or invalid");
        }

        console.log(`[QUEUE] Popped message ID ${msgId}:`, payload);

        let mediaTitle = "Unknown title";

        try {
          let responseData;

          if (payload.media_type === "video_game") {
            console.log(
              `[QUEUE] Calling prepare_game via supabase.functions.invoke...`,
            );

            // Invoke prepare_game for this queue item
            const { data, error: invokeError } =
              await ctx.supabaseAdmin.functions.invoke("prepare_game", {
                body: {
                  igdbId: payload.tmdb_id,
                },
              });

            if (invokeError) {
              console.error(`[QUEUE] prepare_game invoke error:`, invokeError);
              throw new Error(
                `Edge Function prepare_game failed: ${
                  invokeError.message || JSON.stringify(invokeError)
                }`,
              );
            }

            responseData = data;
            console.log(
              `[QUEUE] prepare_game parsed JSON response:`,
              responseData,
            );
          } else {
            console.log(
              `[QUEUE] Calling prepare_media via supabase.functions.invoke...`,
            );

            // Invoke prepare_media for this queue item
            const { data, error: invokeError } =
              await ctx.supabaseAdmin.functions.invoke("prepare_media", {
                body: {
                  tmdbId: payload.tmdb_id,
                  type: payload.media_type,
                  seasonNumber: payload.season_number,
                  episodeNumber: payload.episode_number,
                },
              });

            if (invokeError) {
              console.error(`[QUEUE] prepare_media invoke error:`, invokeError);
              throw new Error(
                `Edge Function prepare_media failed: ${
                  invokeError.message || JSON.stringify(invokeError)
                }`,
              );
            }

            responseData = data;
            console.log(
              `[QUEUE] prepare_media parsed JSON response:`,
              responseData,
            );
          }

          if (responseData && responseData.title) {
            mediaTitle = responseData.title;
          }

          if (!responseData || !responseData.ok) {
            const errorInfo =
              responseData?.error || "Unknown preparation error";
            console.error(
              `[QUEUE] prepare_media returned ok: false. Error info:`,
              errorInfo,
            );
            throw new Error(errorInfo);
          }

          // Archive message upon success
          await ctx.supabaseAdmin.rpc("archive_media_queue_message", {
            p_msg_id: msgId,
          });

          results.push({
            id: msgId,
            ok: true,
            changes: responseData.changes ?? 0,
            error: null,
          });

          console.log(
            `[QUEUE] Successfully processed and archived message ID ${msgId}.`,
          );

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

          await sendOneSignalNotification(
            "Queue Item Processed",
            `Successfully processed ${mediaTitle}${
              payload.season_number ? ` (Season ${payload.season_number})` : ""
            }${
              payload.episode_number
                ? ` (Episode ${payload.episode_number})`
                : ""
            }. Added ${responseData.creditsAdded ?? 0} roles and ${responseData.changes ?? 0} new voice actors.`,
            {
              ...(responseData.imageUrl
                ? { imageUrl: responseData.imageUrl }
                : {}),
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

          if (errMsg.includes("Mistral API Rate Limited (429)")) {
            isRateLimited = true;

            const readCt = Number(queueItem.read_ct);
            const MAX_RETRIES = 5;

            if (readCt >= MAX_RETRIES) {
              console.warn(
                `[QUEUE] Message ID ${msgId} rate limited by Mistral ${readCt} times. Max retries reached. Archiving.`,
              );

              await ctx.supabaseAdmin.rpc(
                "archive_media_queue_message_with_error",
                {
                  p_msg_id: msgId,
                  p_error: `Max retries (${MAX_RETRIES}) reached due to Mistral API Rate Limited (429).`,
                },
              );

              results.push({
                id: msgId,
                ok: false,
                changes: 0,
                error: `Max retries (${MAX_RETRIES}) reached due to Mistral 429`,
              });

              await sendOneSignalNotification(
                "Queue Item Failed (Rate Limit)",
                `Failed to process ${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type} (TMDB ID ${payload.tmdb_id}): Max retries reached due to rate limit.`,
              );
            } else {
              console.warn(
                `[QUEUE] Message ID ${msgId} rate limited by Mistral (Attempt ${readCt}/${MAX_RETRIES}). Leaving in queue to retry later.`,
              );
              results.push({
                id: msgId,
                ok: false,
                changes: 0,
                error: errMsg,
                rate_limited: true,
              });
              // Skip archiving, so the visibility timeout (vt) will expire and it will be retried automatically
            }
          } else {
            const fullErr = err instanceof Error ? err.stack : err;
            console.error(
              `[QUEUE] Error processing message ID ${msgId}:`,
              errMsg,
            );
            console.error(`[QUEUE] Full error stack trace:`, fullErr);

            // Archive message with error attached to archived payload so status helper can retrieve it
            await ctx.supabaseAdmin.rpc(
              "archive_media_queue_message_with_error",
              {
                p_msg_id: msgId,
                p_error: errMsg,
              },
            );

            results.push({
              id: msgId,
              ok: false,
              changes: 0,
              error: errMsg,
            });

            await sendOneSignalNotification(
              "Queue Item Failed",
              `Failed to process ${mediaTitle !== "Unknown title" ? mediaTitle : payload.media_type} (TMDB ID ${payload.tmdb_id}): ${errMsg}`,
            );
          }
        }

        // Check if there are more items in the queue and self-trigger to drain it.
        // This avoids timeout risk (we always process 1 item per invocation) while
        // ensuring the entire queue is drained without requiring a cron job.
        console.log(`[QUEUE] Checking if we need to self-trigger...`);
        if (isRateLimited) {
          console.warn(
            `[QUEUE] Rate limited by Mistral. Halting queue processor self-trigger.`,
          );
        } else if (!isSingle) {
          const { data: queueDepth } = await ctx.supabaseAdmin.rpc(
            "get_media_queue_depth",
          );

          if (queueDepth && (queueDepth as number) > 0) {
            console.log(
              `[QUEUE] ${queueDepth} more item(s) in queue, self-triggering another invocation.`,
            );
            // Fire-and-forget another invocation to process the next item
            console.log(`[QUEUE] Initiating fetch for self-trigger...`);
            ctx.supabaseAdmin.functions
              .invoke("process-media-queue", {
                body: { force: true },
              })
              .then(() => {
                console.log(
                  `[QUEUE] Self-trigger fetch completed successfully.`,
                );
              })
              .catch((err) => {
                console.error(
                  "[QUEUE] Failed to self-trigger next invocation:",
                  err,
                );
              });
          } else {
            console.log(`[QUEUE] queueDepth is 0 or invalid. Stopping loop.`);
          }
        } else {
          console.log(`[QUEUE] Single mode enabled. Skipping self-trigger.`);
        }

        console.log(`[QUEUE] Invocation finished. Returning results.`);
        return Response.json({ ok: true, processed: results.length, results });
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null
              ? (error as any).message || JSON.stringify(error)
              : String(error);
        console.error(
          "[QUEUE] Uncaught error in process-media-queue:",
          errorMsg,
        );
        console.error(
          "[QUEUE] Uncaught error full trace:",
          error instanceof Error ? error.stack : error,
        );

        await sendOneSignalNotification(
          "Queue Processor FAILED",
          `Critical failure in process-media-queue: ${errorMsg}`,
        );

        return Response.json({ ok: false, error: errorMsg }, { status: 500 });
      }
    },
  ),
};
