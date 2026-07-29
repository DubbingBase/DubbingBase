import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchResult = {
  id: number;
  media_type: "movie" | "tv" | "voice_actor";
  title?: string;
  name?: string;
  voice_actor_name?: string;
  firstname?: string;
  lastname?: string;
  profile_path?: string;
  poster_path?: string;
  popularity?: number;
  score?: number;
};

export async function fetchSearchData(
  supabase: SupabaseClient,
  query: string
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const response = await supabase.functions.invoke<SearchResult[]>("search", {
    body: { query: trimmedQuery },
  });

  if (response.error) {
    console.error("fetchSearchData error:", response.error);
    return [];
  }

  return response.data || [];
}
