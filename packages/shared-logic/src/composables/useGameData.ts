import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameResponse } from "@supabase/functions/_shared/types";

export async function fetchGameData(
  supabase: SupabaseClient,
  id: string | number,
): Promise<GameResponse | null> {
  const gameResponseRaw = await supabase.functions.invoke<GameResponse>(
    "game",
    {
      body: { id },
    },
  );

  const data = gameResponseRaw.data;
  if (!data || !data.game) {
    console.error(
      "fetchGameData: Response is null or missing game property",
      gameResponseRaw,
    );
    return null;
  }

  return data;
}
