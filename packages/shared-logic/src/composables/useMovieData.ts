export async function fetchMovieData(
  id: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<any>(`/api/movie/${id}`, { headers });
    if (!data || !data.movie) {
      console.error(
        "fetchMovieData: Response is null or missing movie property",
      );
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchMovieData error:", e);
    return null;
  }
}
