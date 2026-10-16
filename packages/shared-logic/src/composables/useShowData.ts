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

  try {
    const data = await $fetch<ShowDetailResponse>(`/api/show/${id}`, {
      headers,
      ...(options.projection ? { query: { projection: options.projection } } : {}),
    });
    if (!data || !data.serie) {
      console.error("fetchShowData: Response is null or missing serie property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchShowData error:", e);
    return null;
  }
}
