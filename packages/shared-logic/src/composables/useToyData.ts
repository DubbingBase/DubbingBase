import type { ToyResponse } from "../types";

export async function fetchToyData(
  id: string | number,
  locale?: string,
  projection?: "media-page" | "media-summary",
): Promise<ToyResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<ToyResponse>(`/api/toy/${id}`, {
      headers,
      ...(projection ? { query: { projection } } : {}),
    });
    if (!data || !data.toy) {
      console.error("fetchToyData: Response is null or missing toy property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchToyData error:", e);
    return null;
  }
}
