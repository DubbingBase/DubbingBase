// ============================================
// Re-exports from modular type files (Pure Hard Switch)
// ============================================

// Media Types (core)
export * from "./media-types.ts";

// IGDB Types (extended for search/trending) - only re-export non-conflicting types
export type {
  IgdbGame,
  IgdbGenre,
  IgdbReleaseDate,
  IgdbWebsite,
  IgdbScreenshot,
  IgdbVideo,
  IgdbGameEngine,
  IgdbGameMode,
  IgdbTheme,
  IgdbPlayerPerspective,
  IgdbAgeRating,
  IgdbMultiplayerMode,
  IgdbLanguageSupport,
  IgdbLanguage,
  IgdbAlternativeName,
  IgdbArtwork,
  IgdbGameLocalization,
  IgdbFranchise,
  IgdbCollection,
  IgdbSearchResult,
} from "./igdb-types.ts";

// Voice Actor Types
export * from "./voice-actor-types.ts";

// Mistral AI Types
export * from "./mistral-types.ts";

// ============================================
// TMDB Response Types (for trending, search endpoints)
// ============================================

export interface TrendingResponse {
  page: number;
  results: Array<Movie>;
  total_pages: number;
  total_results: number;
}

export interface SearchResponse {
  page: number;
  results: SearchResult[];
  total_pages: number;
  total_results: number;
}

// Minimal Movie type for trending/search results (NOT full detail)
export interface Movie {
  adult: boolean;
  backdrop_path: string;
  id: number;
  title: string;
  original_language: string;
  original_title: string;
  overview: string;
  poster_path: string;
  media_type: "movie";
  genre_ids: number[];
  popularity: number;
  release_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

// Search result types
export interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: "movie" | "tv" | "person" | "video_game";
  genre_ids?: number[];
  profile_path?: string | null;
  known_for?: SearchResult[];
}

export interface Person {
  id: number;
  name: string;
  profile_path: string | null;
  known_for: SearchResult[];
  known_for_department: string;
  popularity: number;
  adult: boolean;
}

export interface Serie {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  media_type: "tv";
}

// Additional types needed by edge functions
export interface WithCast {
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
  };
}

export interface Actor {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  profile_picture?: string | null;
  performance?: string;
}
