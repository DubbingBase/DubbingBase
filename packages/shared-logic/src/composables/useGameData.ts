export async function fetchGameData(
  id: string | number,
  locale?: string,
): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<any>(`/api/game/${id}`, { headers });
    if (!data || !data.game) {
      console.error("fetchGameData: Response is null or missing game property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchGameData error:", e);
    return null;
  }
}
