import type { Database } from "@app/supabase";
import type { MediaDetailCredits, MediaDetailDubbingProject } from "@app/shared-logic";

type VoiceActorRow = Database["public"]["Tables"]["voice_actors"]["Row"];
type WorkRow = Database["public"]["Tables"]["work"]["Row"];

export interface WorkVoteSummary {
  up_count: number;
  down_count: number;
  user_vote: string | null;
}

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

export type VoiceActorDetails = Pick<
  VoiceActorRow,
  | "id"
  | "bio"
  | "awards"
  | "lastname"
  | "firstname"
  | "nationality"
  | "years_active"
  | "date_of_birth"
  | "social_media_links"
  | "profile_picture"
>;

export type WorkAndVoiceActor = Pick<
  WorkRow,
  | "id"
  | "actor_id"
  | "voice_actor_id"
  | "highlight"
  | "suggestions"
  | "status"
  | "source_id"
  | "performance"
> & {
  content_id: number;
  voiceActorDetails: VoiceActorDetails;
};

export interface MovieResponse {
  movie: Movie & WithCast & WithExtrernalIds;
  characterProfilePictures?: Array<{
    id: number;
    name: string;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }>;
  dubbingProjects?: MediaDetailDubbingProject[];
  votes?: Record<number, WorkVoteSummary>;
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

export interface SerieTrendingResponse {
  page: number;
  results: Array<Serie>;
  total_pages: number;
  total_results: number;
}

export interface SerieResponse {
  serie: Serie & WithCast & WithExtrernalIds;
  votes?: Record<number, WorkVoteSummary>;
}

export interface ShowResponse {
  serie: Serie & WithCast & WithExtrernalIds;
  aggregateCredits?: MediaDetailCredits;
  characterProfilePictures?: Array<{
    id: number;
    name: string;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }>;
  dubbingProjects?: MediaDetailDubbingProject[];
  votes?: Record<number, WorkVoteSummary>;
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

export interface IgdbPopularityPrimitive {
  id: number;
  game_id: number;
  value: number;
  popularity_type: number;
  calculated_at?: string;
}

export interface GameResponse {
  game: IgdbGame | null;
  characters: IgdbCharacter[];
  dubbingProjects: MediaDetailDubbingProject[];
  votes: Record<number, WorkVoteSummary>;
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
  dubbingProjects: MediaDetailDubbingProject[];
  votes: Record<number, WorkVoteSummary>;
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
  dubbingProjects: MediaDetailDubbingProject[];
  votes: Record<number, WorkVoteSummary>;
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
  dubbingProjects: MediaDetailDubbingProject[];
  votes: Record<number, WorkVoteSummary>;
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
  dubbingProjects: MediaDetailDubbingProject[];
  votes: Record<number, WorkVoteSummary>;
}
