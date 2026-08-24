export async function fetchShowData(
  id: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<any>(`/api/show/${id}`, { headers });
    if (!data) {
      console.error("fetchShowData: Response is null");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchShowData error:", e);
    return null;
  }
}
