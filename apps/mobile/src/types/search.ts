/**
 * Shared search result type used across search views and components.
 */
export type SearchResult = {
  id: number;
  media_type: "movie" | "tv" | "person" | "voice_actor" | "video_game";
  poster_path?: string;
  profile_path?: string;
  title?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  release_date?: string;
  first_air_date?: string;
  known_for_department?: string;
  nationality?: string;
  years_active?: string;
  awards?: string;
  score?: number;
  // IGDB-specific fields (media_type === "video_game")
  cover?: { image_id: string; url?: string };
  /** Unix timestamp in seconds */
  first_release_date?: number;
  genres?: { id: number; name: string }[];
  platforms?: { id: number; name: string }[];
};
