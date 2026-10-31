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

  const data = await $fetch<AudiobookResponse>(`/api/audiobook/${id}`, {
    headers,
    ...(options.projection ? { query: { projection: options.projection } } : {}),
  });
  if (!data || !data.audiobook) {
    throw new Error("Audiobook response is missing the audiobook record");
  }
  return data;
}
