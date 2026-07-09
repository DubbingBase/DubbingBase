import { supabase } from "./supabase";

/**
 * Enqueue a media fetch request and immediately trigger the queue processor.
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
