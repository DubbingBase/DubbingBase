import type { DetailCollectionProject } from "@app/shared-logic";

/** Distinct voice actors credited in a dubbing project, preferring the server-provided count. */
export function detailProjectVoiceActorCount(project: DetailCollectionProject): number {
  if (project.voice_actor_count !== undefined) return project.voice_actor_count;
  const ids = new Set<number>();
  for (const work of project.works || []) {
    const id = work.voice_actor?.id || work.voice_actor_id;
    if (id) ids.add(id);
  }
  return ids.size;
}

interface DubbingCrewRow {
  id: number;
  jobs?: { name?: string | null } | null;
  voice_actors?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
  } | null;
}

/** Normalizes dubbing project crew rows for the shared crew card. */
export function toCrewCardMembers(rows: DubbingCrewRow[] | null | undefined) {
  return (rows ?? []).map((member) => ({
    id: member.id,
    role: member.jobs?.name,
    personId: member.voice_actors?.id,
    name: `${member.voice_actors?.firstname ?? ""} ${member.voice_actors?.lastname ?? ""}`.trim(),
  }));
}
