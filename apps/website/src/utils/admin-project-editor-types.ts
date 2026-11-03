/** Shapes loaded by the admin project editors; they mirror the Supabase selects they run. */
export interface EditorSelectOption {
  id: number;
  name: string;
}

export interface EditorProjectTab {
  id: number;
  language: string | null;
  studios: { name: string | null } | null;
}

export interface EditorProjectCrew {
  job_id: number;
  person_id: number;
  voice_actors: { firstname: string | null; lastname: string | null } | null;
}

export interface EditorProjectWork {
  id: number;
  actor_id: number | null;
  character_id: number | null;
  character_name: string | null;
  voice_actor_id: number | null;
  performance: string | null;
  note: string | null;
  highlight: boolean | null;
  status: string | null;
  updated_at: string | null;
  voice_actors: { firstname: string | null; lastname: string | null } | null;
}

export interface EditorProjectRecord {
  id: number;
  content_id: number;
  content_type: string;
  language: string | null;
  status: string | null;
  studio_id: number | null;
  updated_at: string | null;
  studios: { name: string | null } | null;
  work: EditorProjectWork[];
}

/** A provider cast member offered by the original-actor autocomplete. */
export interface EditorTmdbCastMember {
  id: number | string;
  name: string;
  character?: string | null;
  profile_path?: string | null;
  roles?: { character?: string | null }[];
}
