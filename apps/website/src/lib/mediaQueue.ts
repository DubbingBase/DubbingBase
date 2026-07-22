import { supabase } from "./supabase";

/**
 * Enqueue a media fetch request and fire-and-forget the queue processor.
 *
 * The item is inserted into the pgmq queue via `enqueue_media_fetch`, which
 * ensures it is visible in the Admin Queue Management UI and can be retried.
 * The processor is then triggered asynchronously so the caller does not need
 * to wait for completion.
 */
export async function enqueueAndProcessMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<void> {
  // Enqueue the item so it is tracked in the queue
  const { error } = await supabase.rpc("enqueue_media_fetch", {
    p_tmdb_id: params.tmdbId,
    p_media_type: params.mediaType,
    p_season_number: params.seasonNumber ?? null,
    p_episode_number: params.episodeNumber ?? null,
  });

  if (error) {
    throw error;
  }

  // Fire-and-forget: trigger the processor to pick it up immediately.
  supabase.functions.invoke("process-media-queue").catch((err) => {
    console.error("Failed to trigger process-media-queue:", err);
  });
}
