import type { PodcastResponse } from "../types";

export async function fetchPodcastData(
  id: string | number,
  locale?: string,
  options: { projection?: "podcast-page" | "media-summary" } = {},
): Promise<PodcastResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<PodcastResponse>(`/api/podcast/${id}`, {
      headers,
      ...(options.projection ? { query: { projection: options.projection } } : {}),
    });
    if (!data || !data.podcast) {
      console.error("fetchPodcastData: Response is null or missing podcast property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchPodcastData error:", e);
    return null;
  }
}
