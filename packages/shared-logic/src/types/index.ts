export type {
  Tables,
  Database,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "@app/supabase";

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

export type MovieModel = Movie;

export interface TrendingResponse {
  page: number;
  results: Array<Movie>;
  total_pages: number;
  total_results: number;
}

export type MovieTrendingResponse = TrendingResponse;

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

export type SerieModel = Serie;

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
  category: number;
}

export interface IgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  rating?: number;
  rating_count?: number;
  first_release_date?: number;
  cover?: IgdbCover;
  artworks?: { id?: number; image_id: string; url?: string }[];
  screenshots?: { id?: number; image_id: string; url?: string }[];
  genres?: IgdbGenre[];
  platforms?: IgdbPlatform[];
  involved_companies?: IgdbInvolvedCompany[];
  external_games?: IgdbExternalGame[];
  websites?: { url: string; category: number }[];
  media_type?: "video_game";
}

export interface IgdbCharacter {
  id: number;
  name: string;
  description?: string;
  mug_shot?: IgdbMugShot;
  species?: { id: number; name: string };
  gender?: number;
  games?: number[];
}

export interface GameResponse {
  game: IgdbGame | null;
  characters: IgdbCharacter[];
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}

export interface OpenLibraryAuthor {
  id?: string;
  name: string;
}

export interface Audiobook {
  id: number;
  title: string;
  name?: string;
  description?: string;
  authors?: OpenLibraryAuthor[];
  author_name?: string;
  cover_url?: string | null;
  cover_id?: number | null;
  first_publish_year?: number | null;
  first_publish_date?: string | null;
  publish_date?: string | null;
  release_date?: string | null;
  isbn?: string | null;
  subjects?: string[];
  media_type?: "audiobook";
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

export interface AudiobookResponse {
  audiobook: Audiobook | null;
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}

export interface Advertisement {
  id: number;
  title: string;
  brand: string;
  year?: number | string;
  poster_url?: string | null;
  video_url?: string | null;
  video_id?: string | null;
  country?: string;
  agency?: string;
  description?: string;
  media_type: "advertisement";
  popularity?: number;
}

export interface AdvertisementResponse {
  advertisement: Advertisement | null;
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}

export interface PodcastEpisode {
  id: number | string;
  title: string;
  description?: string;
  release_date?: string;
  duration?: number | string;
  audio_url?: string;
}

export interface Podcast {
  id: number;
  title: string;
  author?: string;
  feed_url?: string;
  cover_url?: string | null;
  episodes_count?: number;
  release_date?: string;
  genres?: string[];
  description?: string;
  episodes?: PodcastEpisode[];
  media_type: "podcast";
  popularity?: number;
}

export interface PodcastResponse {
  podcast: Podcast | null;
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}

export interface Toy {
  id: number;
  name: string;
  manufacturer: string;
  product_line?: string;
  release_year?: number | string;
  cover_url?: string | null;
  description?: string;
  media_type: "toy";
  popularity?: number;
}

export interface ToyResponse {
  toy: Toy | null;
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}

export interface Role {
  character: string;
  image?: string;
}

export interface PersonData<T = unknown | undefined> {
  id: number;
  name?: string;
  firstname?: string;
  lastname?: string;
  roles?: Role[];
  profile_picture?: string | null;
  profile_path?: string;
  performance?: string;
  tags?: string[] | string;
  tmdb_id?: number;
  data?: T;
  character?: string;
  reviewed_status?: string | null;
  work_id?: number;
  status?: string | null;
}
