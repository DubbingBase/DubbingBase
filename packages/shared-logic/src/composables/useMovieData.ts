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

  const data = await $fetch<MovieDetailResponse>(`/api/movie/${id}`, {
    headers,
    ...(options.projection ? { query: { projection: options.projection } } : {}),
  });
  if (!data || !data.movie) {
    throw new Error("Movie response is missing the movie record");
  }
  return data;
}
