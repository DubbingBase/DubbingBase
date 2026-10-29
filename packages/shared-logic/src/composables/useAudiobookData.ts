import type { AudiobookResponse } from "../types";

export async function fetchAudiobookData(
  id: string | number,
  locale?: string,
  options: { projection?: "media-page" } = {},
): Promise<AudiobookResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<AudiobookResponse>(`/api/audiobook/${id}`, {
      headers,
      ...(options.projection ? { query: { projection: options.projection } } : {}),
    });
    if (!data || !data.audiobook) {
      console.error("fetchAudiobookData: Response is null or missing audiobook property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchAudiobookData error:", e);
    return null;
  }
}
