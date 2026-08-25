// Movie-related types
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
  genre_ids: Array<number>;
  popularity: number;
  release_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string;
    backdrop_path: string;
  };
}

export interface TrendingResponse {
  page: number;
  results: Array<Movie>;
  total_pages: number;
  total_results: number;
}

export interface VoiceActorDetails {
  id: number;
  bio: any;
  awards: any;
  lastname: string;
  firstname: string;
  nationality: any;
  years_active: any;
  date_of_birth: any;
  social_media_links: any;
  profile_picture?: string;
}

export interface WorkAndVoiceActor {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number;
  highlight: boolean;
  suggestions: any;
  status: string;
  source_id: any;
  voiceActorDetails: VoiceActorDetails;
  performance?: string;
}

export interface MovieResponse {
  movie: Movie & WithCast & WithExtrernalIds;
  characterProfilePictures?: Array<{
    id: number;
    name: string;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }>;
  dubbingProjects?: any[];
  votes?: Record<number, any>;
  collection?: {
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    backdrop_path: string;
    parts: Movie[];
  };
}

// Series-related types
export interface Season {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
  vote_average: number;
}

export interface Serie {
  adult: boolean;
  backdrop_path: string;
  id: number;
  name: string;
  original_language: string;
  original_title: string;
  overview: string;
  poster_path: string;
  media_type: "tv";
  genre_ids: Array<number>;
  popularity: number;
  first_air_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  seasons: Season[];
}

export interface SerieTrendingResponse {
  page: number;
  results: Array<Serie>;
  total_pages: number;
  total_results: number;
}

export interface SerieResponse {
  serie: Serie & WithCast & WithExtrernalIds;
  votes?: Record<number, any>;
}

export interface ShowResponse {
  serie: Serie & WithCast & WithExtrernalIds;
  aggregateCredits?: any;
  characterProfilePictures?: Array<{
    id: number;
    name: string;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }>;
  dubbingProjects?: any[];
  votes?: Record<number, any>;
}

// Actor-related types
export interface ActorCredits {
  cast: Array<Movie | Serie>;
}

export interface Actor {
  biography: string;
  birthday: string;
  deathday: string;
  gender: 1 | 2;
  id: number;
  name: string;
  place_of_birth: string;
  profile_path: string;
  credits: ActorCredits;
  roles?: {
    credit_id: string;
    character: string;
    episode_count: number;
  }[];
  character?: string;
}

// Common types
export interface Cast {
  gender: number;
  id: number;
  name: string;
  profile_path: string;
  cast_id: number;
  character: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface WithCast {
  genres: Array<Genre>;
  credits: {
    cast: Array<Cast>;
  };
}

export interface WithExtrernalIds {
  external_ids: {
    imdb_id?: string;
    wikidata_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

// LLM extraction output types
export interface LlmMovieExtractOutput {
  items?: LlmMovieExtractItemOutput[];
}

export interface LlmMovieExtractItemOutput {
  actor: string;
  voiceActorName: string;
  voiceActorFirstname: string;
  performance?: string;
}

export interface LlmVoiceActorExtractOutput {
  items?: LlmVoiceActorExtractItemOutput[];
}

export interface LlmVoiceActorExtractItemOutput {
  actor: string;
  performance?: string;
  production?: string;
  year?: number;
}

// ─── IGDB types ───────────────────────────────────────────────────────────────

export interface IgdbCover {
  image_id: string;
  url?: string;
}

export interface IgdbMugShot {
  image_id: string;
  url?: string;
}

export interface IgdbGenre {
  id: number;
  name: string;
}

export interface IgdbPlatform {
  id: number;
  name: string;
  slug?: string;
}

export interface IgdbCompany {
  id: number;
  name: string;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: IgdbCompany;
  developer: boolean;
  publisher: boolean;
}

export interface IgdbExternalGame {
  id: number;
  uid: string;
  /** 1 = Steam, 5 = GOG, 11 = Xbox, 14 = PlayStation, etc. */
  category: number;
}

export interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  rating?: number;
  rating_count?: number;
  /** Unix timestamp in seconds */
  first_release_date?: number;
  cover?: IgdbCover;
  genres?: IgdbGenre[];
  platforms?: IgdbPlatform[];
  involved_companies?: IgdbInvolvedCompany[];
  external_games?: IgdbExternalGame[];
  websites?: { url: string; category: number }[];
  /** Computed field: media_type used by the unified search results */
  media_type?: "video_game";
}

export interface IgdbCharacter {
  id: number;
  name: string;
  description?: string;
  mug_shot?: IgdbMugShot;
  /** IGDB species (e.g. "Human") */
  species?: { id: number; name: string };
  /** IGDB gender enum: 0 = Male, 1 = Female, 2 = Questionable */
  gender?: number;
  games?: number[];
}

export interface IgdbPopularityPrimitive {
  id: number;
  game_id: number;
  value: number;
  /** 1 = Visits, 2 = Want to Play, 3 = Playing, 4 = Played, 5 = Steam 24h Peak, etc. */
  popularity_type: number;
  calculated_at?: string;
}

/** Response shape from the `game` edge function */
export interface GameResponse {
  game: IgdbGame | null;
  characters: IgdbCharacter[];
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}
