import type { Database } from "@app/supabase";

type ProjectRow = Database["public"]["Tables"]["dubbing_projects"]["Row"];
type WorkRow = Database["public"]["Tables"]["work"]["Row"];
type CrewRow = Database["public"]["Tables"]["dubbing_project_crew"]["Row"];
type VoiceActorRow = Database["public"]["Tables"]["voice_actors"]["Row"];

type VoiceActorName = Pick<VoiceActorRow, "firstname" | "lastname">;

export type DubbingProjectTab = Pick<ProjectRow, "id" | "language" | "studio_id"> & {
  studios: Pick<Database["public"]["Tables"]["studios"]["Row"], "name"> | null;
};

export type DubbingProjectEditorProject = ProjectRow & {
  studios: Pick<Database["public"]["Tables"]["studios"]["Row"], "name"> | null;
  work: DubbingProjectEditorWork[];
};

export type DubbingProjectEditorCrew = Pick<CrewRow, "job_id" | "person_id"> & {
  voice_actors: VoiceActorName | null;
};

export type DubbingProjectEditorWork = Pick<
  WorkRow,
  | "id"
  | "actor_id"
  | "character_id"
  | "character_name"
  | "voice_actor_id"
  | "performance"
  | "note"
  | "highlight"
  | "status"
  | "updated_at"
> & { voice_actors: VoiceActorName | null };

export type DubbingProjectEditorStudio = Pick<
  Database["public"]["Tables"]["studios"]["Row"],
  "id" | "name"
>;

export type DubbingProjectEditorVoiceActor = Pick<VoiceActorRow, "id" | "firstname" | "lastname">;

export interface DubbingProjectEditorVoiceActorOption {
  id: number;
  name: string;
}

export interface TmdbEditorCastMember {
  id: number;
  name?: string;
  character?: string | null;
  roles?: Array<{ character: string }>;
}

export function readSingleRouteParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }
  return undefined;
}
