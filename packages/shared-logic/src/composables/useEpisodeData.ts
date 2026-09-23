export async function fetchEpisodeData(
  showId: string | number,
  seasonNumber: string | number,
  episodeNumber: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  return await $fetch<any>(`/api/episode`, {
    headers,
    timeout: 20_000,
    query: {
      id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    },
  });
}
