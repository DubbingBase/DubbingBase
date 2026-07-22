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
  await enqueueMedia(params);

  // Fire-and-forget: trigger the processor to pick it up immediately.
  // We do not await so the UI is not blocked waiting for the import to finish.
  supabase.functions.invoke("process-media-queue").catch((err) => {
    console.error("Failed to trigger process-media-queue:", err);
  });
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

  // In development mode (where there is no pg_cron), manually trigger the
  // queue processor so the item is picked up right away. We do this as a
  // fire-and-forget call to avoid blocking the UI.
  if (import.meta.env.DEV) {
    supabase.functions.invoke("process-media-queue").catch((err) => {
      console.error("Failed to trigger process-media-queue in dev:", err);
    });
  }
}
