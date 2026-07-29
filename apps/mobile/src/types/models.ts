import type { Tables } from "@supabase/functions/_shared/database.types";

export interface ProfileWorkItem extends Tables<"work"> {
  content_type?: string;
  dubbing_projects?: { content_id: number };
}

export interface MediaCreditCast {
  id: number;
  character: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  poster_path?: string;
  roles?: Array<{ character?: string }>;
}

export interface VoiceActorInfo {
  id: number;
  firstname?: string;
  lastname?: string;
  profile_picture?: string | null;
  work_id?: number;
  performance?: string;
  reviewed_status?: string;
  status?: string | null;
}

export interface SeasonInfo {
  name?: string;
  episodes?: unknown[];
}

export interface StudioInfo {
  id: number;
  name: string;
  logo_path?: string;
}

export interface DubbingCrewInfo {
  id: number;
  name: string;
  job: string;
}

export interface MediaSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
}
