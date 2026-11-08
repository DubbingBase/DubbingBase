export type EpisodeDataResponse = {
  episode: Record<string, unknown>;
} & Record<string, unknown>;

export async function fetchEpisodeData(
  showId: string | number,
  seasonNumber: string | number,
  episodeNumber: string | number,
  locale?: string,
): Promise<EpisodeDataResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<EpisodeDataResponse>(`/api/episode`, {
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
