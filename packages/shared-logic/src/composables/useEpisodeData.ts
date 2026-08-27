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

  try {
    const data = await $fetch<any>(`/api/episode`, {
      headers,
      query: {
        id: showId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
      },
    });
    if (!data) {
      console.error("fetchEpisodeData: Response is null");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchEpisodeData error:", e);
    return null;
  }
}
