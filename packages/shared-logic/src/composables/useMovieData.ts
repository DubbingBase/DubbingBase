import type { MovieDetailResponse } from "../types/media-detail";

export async function fetchMovieData(
  id: string | number,
  locale?: string,
  options: { projection?: "media-page" } = {},
): Promise<MovieDetailResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<MovieDetailResponse>(`/api/movie/${id}`, {
      headers,
      ...(options.projection ? { query: { projection: options.projection } } : {}),
    });
    if (!data || !data.movie) {
      console.error("fetchMovieData: Response is null or missing movie property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchMovieData error:", e);
    return null;
  }
}
