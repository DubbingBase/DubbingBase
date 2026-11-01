export interface MediaDetailVoiceActor extends Record<string, unknown> {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  profile_picture?: string | null;
  voice_actor_name?: string | null;
}

export interface MediaDetailWork extends Record<string, unknown> {
  id: number;
  actor_id: number | string | null;
  voice_actor_id?: number | null;
  character_name?: string | null;
  performance?: string | null;
  note?: string | null;
  voice_actor?: MediaDetailVoiceActor | null;
}

export interface MediaDetailStudio extends Record<string, unknown> {
  id: number;
  name: string;
  logo_url?: string | null;
}

export interface MediaDetailDubbingProject extends Record<string, unknown> {
  id: number;
  language?: string | null;
  studio_data?: MediaDetailStudio | null;
  works?: MediaDetailWork[];
  crew?: unknown[];
}

export interface MediaDetailCastMember extends Record<string, unknown> {
  id: number;
  name?: string;
  character?: string | null;
  profile_path?: string | null;
  roles?: Array<{ character: string; episode_count?: number }>;
}

export interface MediaDetailCredits extends Record<string, unknown> {
  cast?: MediaDetailCastMember[];
}

export interface MediaDetailMedia extends Record<string, unknown> {
  id: number;
  title?: string;
  original_title?: string | null;
  name?: string;
  original_name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  original_language?: string | null;
  number_of_seasons?: number | null;
  vote_average?: number | null;
  credits?: MediaDetailCredits | null;
  seasons?: MediaDetailSeason[];
}

export interface MediaDetailSeason extends Record<string, unknown> {
  season_number: number;
  name?: string | null;
  poster_path?: string | null;
  episode_count?: number | null;
}

export interface MediaDetailCharacterProfilePicture extends Record<string, unknown> {
  name?: string | null;
  image?: string | null;
}

interface MediaDetailResponseBase {
  dubbingProjects: MediaDetailDubbingProject[];
  voiceActors?: MediaDetailVoiceActor[];
  characterProfilePictures: MediaDetailCharacterProfilePicture[];
  tvdbId: number | null;
}

export interface MovieDetailResponse extends MediaDetailResponseBase {
  movie: MediaDetailMedia;
  collection: Record<string, unknown> | null;
}

export interface ShowDetailResponse extends MediaDetailResponseBase {
  serie: MediaDetailMedia;
  aggregateCredits: MediaDetailCredits;
}
