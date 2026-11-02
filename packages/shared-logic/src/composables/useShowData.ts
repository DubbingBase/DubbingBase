import type { ShowDetailResponse } from "../types/media-detail";

export async function fetchShowData(
  id: string | number,
  locale?: string,
  options: { projection?: "media-page" } = {},
): Promise<ShowDetailResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const data = await $fetch<ShowDetailResponse>(`/api/show/${id}`, {
    headers,
    ...(options.projection ? { query: { projection: options.projection } } : {}),
  });
  if (!data || !data.serie) {
    throw new Error("Show response is missing the show record");
  }
  return data;
}
