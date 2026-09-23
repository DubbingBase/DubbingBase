import type {
  fetchEpisodeData as fetchSharedEpisodeData,
  fetchSeasonData as fetchSharedSeasonData,
} from "@app/shared-logic";

type SeasonDataResponse = Awaited<ReturnType<typeof fetchSharedSeasonData>>;
type EpisodeDataResponse = Awaited<ReturnType<typeof fetchSharedEpisodeData>>;

export async function fetchSeasonPageData(
  showId: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<SeasonDataResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch("/api/season", {
    headers,
    timeout: 20_000,
    query: { id: showId, season_number: seasonNumber },
  });
}

export async function fetchEpisodePageData(
  showId: string | number,
  seasonNumber: string | number,
  episodeNumber: string | number,
  locale?: string,
): Promise<EpisodeDataResponse> {
  const headers: Record<string, string> = {};
  if (locale) headers["Accept-Language"] = locale;

  return await $fetch("/api/episode", {
    headers,
    timeout: 20_000,
    query: {
      id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    },
  });
}
