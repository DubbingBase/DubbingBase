export type SeasonDataResponse = {
  season: Record<string, unknown>;
} & Record<string, unknown>;

export async function fetchSeasonData(
  showId: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<SeasonDataResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<SeasonDataResponse>(`/api/season`, {
      headers,
      query: {
        id: showId,
        season_number: seasonNumber,
      },
    });
    if (!data) {
      console.error("fetchSeasonData: Response is null");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchSeasonData error:", e);
    return null;
  }
}
