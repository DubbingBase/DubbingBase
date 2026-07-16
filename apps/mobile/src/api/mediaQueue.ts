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
  const { error } = await supabase.rpc("enqueue_media_fetch", {
    p_tmdb_id: params.tmdbId,
    p_media_type: params.mediaType,
    p_season_number: params.seasonNumber ?? undefined,
    p_episode_number: params.episodeNumber ?? undefined,
  });

  if (error) {
    throw error;
  }

  // In development mode (where there is no pg_cron), manually trigger the 
  // queue processor so the item is picked up right away. We do this as a 
  // fire-and-forget call to avoid blocking the UI.
  if (import.meta.env.DEV) {
    supabase.functions.invoke("process-media-queue").catch((err) => {
      console.error("Failed to trigger process-media-queue in dev:", err);
    });
  }
}
