/**
 * Enqueue a media fetch request and fire-and-forget the queue processor.
 *
 * The item is inserted into the pgmq queue via `enqueue_media_fetch`, which
 * ensures it is visible in the Admin Queue Management UI and can be retried.
 * The processor is then triggered asynchronously so the caller does not need
 * to wait for completion.
 */
export async function enqueueMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  language?: string | null;
}): Promise<void> {
  const supabase = useSupabaseClient();
  const { error } = await (supabase as any).rpc("enqueue_media_fetch", {
    p_tmdb_id: params.tmdbId,
    p_media_type: params.mediaType,
    p_season_number: params.seasonNumber ?? null,
    p_episode_number: params.episodeNumber ?? null,
    p_language: params.language ?? null,
  });

  if (error) {
    throw error;
  }
}
