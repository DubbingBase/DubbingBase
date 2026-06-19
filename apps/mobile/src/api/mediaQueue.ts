import { supabase } from "./supabase";

/**
 * Enqueue a media fetch request and immediately trigger the queue processor.
 *
 * This is needed because the `process-media-queue` edge function is not
 * triggered automatically (no cron job or database trigger). After inserting
 * a message into the pgmq queue via `enqueue_media_fetch`, we fire-and-forget
 * an invocation of the processor so the item gets picked up right away.
 */
export async function enqueueAndProcessMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<void> {
  // 1. Enqueue via RPC (this throws on duplicate / error)
  const { error: enqueueError } = await supabase.rpc("enqueue_media_fetch", {
    p_tmdb_id: params.tmdbId,
    p_media_type: params.mediaType,
    p_season_number: params.seasonNumber ?? undefined,
    p_episode_number: params.episodeNumber ?? undefined,
  });

  if (enqueueError) throw enqueueError;

  // 2. Fire-and-forget: invoke the processor so the item is picked up immediately.
  //    We intentionally don't await the result — the frontend polls queue status separately.
  supabase.functions
    .invoke("process-media-queue")
    .then((res) => {
      if (res.error) {
        console.warn("[mediaQueue] process-media-queue invocation warning:", res.error);
      }
    })
    .catch((err) => {
      console.warn("[mediaQueue] process-media-queue invocation failed:", err);
    });
}
