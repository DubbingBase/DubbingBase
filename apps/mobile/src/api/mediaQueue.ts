import { supabase } from "./supabase";

/**
 * Enqueue a media fetch request without processing it immediately.
 * The background queue processor or cron worker will pick it up.
 */
export async function enqueueMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<void> {
  const { error } = await (supabase as any).rpc("enqueue_media_fetch", {
    p_tmdb_id: params.tmdbId,
    p_media_type: params.mediaType,
    p_season_number: params.seasonNumber ?? null,
    p_episode_number: params.episodeNumber ?? null,
  });

  if (error) {
    throw error;
  }
}
