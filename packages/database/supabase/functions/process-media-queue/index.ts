import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: ["user", "secret"] }, async (req, ctx) => {
    try {
      const results = [];
      const SUPABASE_SECRET_KEY =
        Deno.env.get("SUPABASE_SECRET_KEY") ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
        "";
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

      // Process exactly 1 item per invocation to guarantee we never hit function timeouts
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

      try {
        // Invoke prepare_media for this queue item
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/prepare_media`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            },
            body: JSON.stringify({
              tmdbId: payload.tmdb_id,
              type: payload.media_type,
              seasonNumber: payload.season_number,
              episodeNumber: payload.episode_number,
            }),
          },
        );

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP status ${response.status}: ${errorBody}`);
        }

        const responseData = await response.json();

        if (!responseData.ok) {
          throw new Error(responseData.error || "Unknown preparation error");
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[QUEUE] Error processing message ID ${msgId}:`,
          errMsg,
        );

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
      }

      return Response.json({ ok: true, processed: results.length, results });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null
            ? JSON.stringify(error)
            : String(error);
      console.error("[QUEUE] Uncaught error in process-media-queue:", errorMsg);

      return Response.json({ ok: false, error: errorMsg }, { status: 500 });
    }
  }),
};
