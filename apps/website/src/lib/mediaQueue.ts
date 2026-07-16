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
  const { data, error } = await supabase.functions.invoke("prepare_media", {
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
