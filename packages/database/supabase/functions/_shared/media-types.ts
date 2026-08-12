// Unified Media Types - Lean, shared across movie, game, tv, episode

// ============================================
// Supporting Types (kept minimal, only what frontend uses)
// ============================================

export interface Genre {
  id: number;
  name: string;
}

export interface ExternalIds {
  imdb_id: string | null;
  wikidata_id: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
}

export interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Season {
  id: number;
  season_number: number;
  episode_count: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string;
  vote_average: number;
}

export interface Collection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
  }>;
}

export interface StudioData {
  id: number;
  name: string;
  logo: string | null;
  website: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

// ============================================
// Base Media Interface
// ============================================

export interface BaseMedia {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  genres: Genre[];
  credits: { cast: Cast[] };
  external_ids: ExternalIds;
  media_type: "movie" | "tv" | "video_game";
}

// ============================================
// Media-Specific Extensions
// ============================================

export interface MovieMedia extends BaseMedia {
  media_type: "movie";
  release_date: string;
  runtime: number | null;
  collection: Collection | null;
}

export interface TVMedia extends BaseMedia {
  media_type: "tv";
  first_air_date: string;
  seasons: Season[];
  status: string;
  aggregateCredits: { cast: Cast[] } | null;
}

export interface GameMedia extends BaseMedia {
  media_type: "video_game";
  first_release_date: number | null;
  summary: string;
  cover: IgdbCover | null;
  platforms: IgdbPlatform[];
  involved_companies: IgdbInvolvedCompany[];
  characters: IgdbCharacter[];
}

export interface EpisodeMedia extends TVMedia {
  media_type: "tv";
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  runtime: number | null;
}

// ============================================
// IGDB Supporting Types (minimal, used by GameMedia)
// ============================================

export interface IgdbCover {
  image_id: string;
  url: string;
}

export interface IgdbPlatform {
  id: number;
  name: string;
  abbreviation: string | null;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: IgdbCompany;
  developer: boolean;
  publisher: boolean;
  porting: boolean;
  supporting: boolean;
}

export interface IgdbCompany {
  id: number;
  name: string;
  logo: string | null;
}

export interface IgdbCharacter {
  id: number;
  name: string;
  mug_shot: IgdbMugShot | null;
}

export interface IgdbMugShot {
  image_id: string;
  url: string;
}

// ============================================
// Dubbing Project Types (matching DubbingProjectsView expectations)
// ============================================

export interface DubbingProject {
  id: number;
  content_id: number;
  content_type: string;
  language: string | null;
  studio_id: number | null;
  studio_data: StudioData | null;
  status: string | null;
  works: WorkPerformance[];
  crew: CrewMember[];
}

export interface WorkPerformance {
  id: number;
  actor_id: number;
  voice_actor_id: number | null;
  highlight: boolean | null;
  suggestions: string | null;
  status: string | null;
  source_id: number | null;
  performance: string | null;
  dubbing_project_id: number;
  voice_actor: VoiceActorSummary | null;
}

export interface VoiceActorSummary {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
  bio: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  awards: string | null;
  years_active: string | null;
  social_media_links: Record<string, string> | null;
  tmdb_id: number | null;
  wikidata_id: string | null;
}

export interface CharacterProfilePicture {
  id: number;
  name: string;
  image: string;
  tvdbPeopleId: number;
  movieId?: number;
  seriesId?: number;
}

export interface VoteData {
  up_count: number;
  down_count: number;
  user_vote: string | null;
}

// ============================================
// Unified Detail Response
// ============================================

export interface MediaDetailResponse<T extends BaseMedia> {
  media: T;
  dubbingProjects: DubbingProject[];
  votes: Record<number, VoteData>;
  characterProfilePictures: CharacterProfilePicture[];
  collection?: Collection | null;
  aggregateCredits?: { cast: Cast[] } | null;
  characters?: IgdbCharacter[];
  tvdbId?: number | null;
}

export type MovieDetailResponse = MediaDetailResponse<MovieMedia>;
export type TVDetailResponse = MediaDetailResponse<TVMedia>;
export type GameDetailResponse = MediaDetailResponse<GameMedia>;
export type EpisodeDetailResponse = MediaDetailResponse<EpisodeMedia>;
