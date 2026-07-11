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
  const { data, error } = await supabase.functions.invoke("prepare_movie", {
    body: {
      tmdbId: params.tmdbId,
      type: params.mediaType,
      seasonNumber: params.seasonNumber ?? undefined,
      episodeNumber: params.episodeNumber ?? undefined,
    },
  });

  if (error) {
    throw error;
  }

  if (data && !data.ok) {
    throw new Error(data.error || "Failed to prepare media");
  }
}
