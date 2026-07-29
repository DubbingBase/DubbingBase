import { supabase } from "./supabase";

/**
 * Enqueue a media fetch request and fire-and-forget the queue processor.
 *


/**
 * Enqueue a media fetch request without processing it immediately.
 * The background cron worker will pick it up later.
 */
export async function enqueueMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<void> {
  const { error } = await supabase.functions.invoke("media-queue", {
    body: {
      action: "enqueue",
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber ?? undefined,
      episodeNumber: params.episodeNumber ?? undefined,
    },
  });

  if (error) {
    throw error;
  }
}
