export async function fetchSeasonData(
  showId: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  return await $fetch<any>(`/api/season`, {
    headers,
    timeout: 20_000,
    query: {
      id: showId,
      season_number: seasonNumber,
    },
  });
}
