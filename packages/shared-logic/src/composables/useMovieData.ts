import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovieDetailResponse } from "@supabase/functions/_shared/types";

export async function fetchMovieData(
  supabase: SupabaseClient,
  id: string | number,
  locale?: string,
): Promise<MovieDetailResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const movieResponseRaw = await supabase.functions.invoke<MovieDetailResponse>(
    "movie",
    {
      body: { id },
      headers,
    },
  );

  const data = movieResponseRaw.data;
  if (!data || !data.media) {
    console.error(
      "fetchMovieData: Response is null or missing media property",
      movieResponseRaw,
    );
    return null;
  }

  return data;
}
