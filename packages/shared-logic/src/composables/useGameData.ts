import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameDetailResponse } from "@supabase/functions/_shared/types";

export async function fetchGameData(
  supabase: SupabaseClient,
  id: string | number,
  locale?: string,
): Promise<GameDetailResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const gameResponseRaw = await supabase.functions.invoke<GameDetailResponse>(
    "game",
    {
      body: { id },
      headers,
    },
  );

  const data = gameResponseRaw.data;
  if (!data || !data.media) {
    console.error(
      "fetchGameData: Response is null or missing media property",
      gameResponseRaw,
    );
    return null;
  }

  return data;
}
