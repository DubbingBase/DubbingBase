import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovieResponse } from "@supabase/functions/_shared/movie";

export async function fetchMovieData(
  supabase: SupabaseClient,
  id: string | number,
): Promise<MovieResponse | null> {
  const movieResponseRaw = await supabase.functions.invoke<MovieResponse>(
    "movie",
    {
      body: { id },
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
