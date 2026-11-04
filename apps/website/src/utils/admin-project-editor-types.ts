import type { Tables } from "@app/supabase/types";
import type { WorkExpectedValues } from "./dubbing-project-save";

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

type VoiceActorName = Pick<Tables<"voice_actors">, "firstname" | "lastname">;

export type EditorProjectCrew = Pick<Tables<"dubbing_project_crew">, "job_id" | "person_id"> & {
  voice_actors: VoiceActorName | null;
};

export type EditorProjectWork = Pick<
  Tables<"work">,
  | "id"
  | "actor_id"
  | "character_id"
  | "character_name"
  | "voice_actor_id"
  | "performance"
  | "note"
  | "highlight"
  | "status"
> & {
  /** Nullable here although the column is not: editors tolerate rows without a version stamp. */
  updated_at: Tables<"work">["updated_at"] | null;
  voice_actors:
    | (VoiceActorName & {
        /** Optional: only selected by editors that show voice actor pictures. */
        profile_picture?: Tables<"voice_actors">["profile_picture"];
      })
    | null;
};

export type EditorProjectRecord = Pick<
  Tables<"dubbing_projects">,
  "id" | "content_id" | "content_type" | "language" | "status" | "studio_id" | "updated_at"
> & {
  studios: Pick<Tables<"studios">, "name"> | null;
  work: EditorProjectWork[];
};

/** Client-only cast row fields shared by every admin project editor. */
export interface EditorCastRowBase {
  /** Client-only stable identity for keyed rendering and row actions. */
  key: string;
  id?: number;
  voice_actor_id: Tables<"work">["voice_actor_id"];
  character_name: string;
  performance: string;
  note: string;
  expectedUpdatedAt?: string | null;
  expected?: WorkExpectedValues;
}

/** A provider cast member offered by the original-actor autocomplete. */
export interface EditorTmdbCastMember {
  id: number | string;
  name: string;
  character?: string | null;
  profile_path?: string | null;
  roles?: { character?: string | null }[];
}
