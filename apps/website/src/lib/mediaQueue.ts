/** Queue a media fetch through the authenticated Worker API. */
export async function enqueueMedia(params: {
  tmdbId: number;
  mediaType: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  language?: string | null;
}): Promise<void> {
  await $fetch("/api/media-queue", {
    method: "POST",
    body: {
      action: "enqueue",
      mediaId: params.tmdbId,
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber ?? undefined,
      episodeNumber: params.episodeNumber ?? undefined,
      language: params.language ?? undefined,
    },
  });
}
