import type { PodcastResponse } from "../types";

export async function fetchPodcastData(
  id: string | number,
  locale?: string,
): Promise<PodcastResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<PodcastResponse>(`/api/podcast/${id}`, {
      headers,
    });
    if (!data || !data.podcast) {
      console.error(
        "fetchPodcastData: Response is null or missing podcast property",
      );
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchPodcastData error:", e);
    return null;
  }
}
