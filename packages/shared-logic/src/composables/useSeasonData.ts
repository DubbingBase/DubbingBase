export async function fetchSeasonData(
  id: string | number,
  seasonNumber: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<any>(`/api/season`, {
      headers,
      params: { id, season_number: seasonNumber },
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
