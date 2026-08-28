import type { AdvertisementResponse } from "../types";

export async function fetchAdvertisementData(
  id: string | number,
  locale?: string,
): Promise<AdvertisementResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<AdvertisementResponse>(
      `/api/advertisement/${id}`,
      {
        headers,
      },
    );
    if (!data || !data.advertisement) {
      console.error(
        "fetchAdvertisementData: Response is null or missing advertisement property",
      );
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchAdvertisementData error:", e);
    return null;
  }
}
