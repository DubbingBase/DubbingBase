import type { PodcastResponse } from "../types";

export async function fetchPodcastData(
  id: string | number,
  locale?: string,
  options: { projection?: "podcast-page" } = {},
): Promise<PodcastResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const data = await $fetch<PodcastResponse>(`/api/podcast/${id}`, {
    headers,
    ...(options.projection ? { query: { projection: options.projection } } : {}),
  });
  if (!data || !data.podcast) {
    throw new Error("Podcast response is missing the podcast record");
  }
  return data;
}
