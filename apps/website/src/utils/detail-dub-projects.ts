import type { DetailCollectionProject, DubbingProjectCrewMember } from "@app/shared-logic";

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

/** Normalizes dubbing project crew rows (the API `crew` projection) for the shared crew card. */
export function toCrewCardMembers(rows: DubbingProjectCrewMember[] | null | undefined) {
  return (rows ?? []).map((member) => ({
    id: member.id,
    role: member.job?.name,
    personId: member.person?.id,
    name: `${member.person?.firstname ?? ""} ${member.person?.lastname ?? ""}`.trim(),
  }));
}
