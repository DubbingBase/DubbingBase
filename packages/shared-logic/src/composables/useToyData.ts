import type { ToyResponse } from "../types";

export async function fetchToyData(
  id: string | number,
  locale?: string,
  projection?: "media-page",
): Promise<ToyResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const data = await $fetch<ToyResponse>(`/api/toy/${id}`, {
    headers,
    ...(projection ? { query: { projection } } : {}),
  });
  if (!data || !data.toy) {
    throw new Error("Toy response is missing the toy record");
  }
  return data;
}
