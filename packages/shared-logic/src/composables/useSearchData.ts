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
  release_date?: string;
  first_air_date?: string;
  first_release_date?: number;
  original_title?: string;
  original_name?: string;
  cover?: { url: string };
};

export async function fetchSearchData(query: string): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  try {
    const data = await $fetch<SearchResult[]>("/api/search", {
      params: { query: trimmedQuery },
    });
    return data || [];
  } catch (e) {
    console.error("fetchSearchData error:", e);
    return [];
  }
}
