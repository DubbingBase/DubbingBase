import type { AdvertisementResponse } from "../types";

export async function fetchAdvertisementData(
  id: string | number,
  locale?: string,
  options?: { projection?: "advertisement-page" },
): Promise<AdvertisementResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const data = await $fetch<AdvertisementResponse>(`/api/advertisement/${id}`, {
    headers,
    query: options?.projection ? { projection: options.projection } : undefined,
  });
  if (!data || !data.advertisement) {
    throw new Error("Advertisement response is missing the advertisement record");
  }
  return data;
}
