import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovieResponse } from "@supabase/functions/_shared/movie";

export async function fetchMovieData(
  supabase: SupabaseClient,
  id: string | number,
  locale?: string,
): Promise<MovieResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const movieResponseRaw = await supabase.functions.invoke<MovieResponse>(
    "movie",
    {
      body: { id },
      headers,
    },
  );

  const data = movieResponseRaw.data;
  if (!data || !data.movie) {
    console.error(
      "fetchMovieData: Response is null or missing movie property",
      movieResponseRaw,
    );
    return null;
  }

  return data;
}
