type ProjectWork = {
  voice_actor?: { id?: number | null } | null;
};

type ProjectWithWorks = {
  id: number;
  works?: readonly (ProjectWork | null)[] | null;
};

export function countProjectVoiceActors<TProject extends ProjectWithWorks>(
  projects: readonly TProject[],
): { visibleProjectIds: Set<number>; countsByProjectId: Map<number, number> } {
  const visibleProjectIds = new Set<number>();
  const countsByProjectId = new Map<number, number>();

  for (const project of projects) {
    const actorIds = new Set<number>();
    for (const work of project.works || []) {
      if (!work?.voice_actor) continue;
      visibleProjectIds.add(project.id);
      if (work.voice_actor.id) actorIds.add(work.voice_actor.id);
    }
    countsByProjectId.set(project.id, actorIds.size);
  }

  return { visibleProjectIds, countsByProjectId };
}
