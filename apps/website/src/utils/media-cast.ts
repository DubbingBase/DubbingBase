export interface CastActorReference {
  id: number;
  name?: string;
  profile_path?: string | null;
  character?: string | null;
  roles?: Array<{ character: string; episode_count?: number }>;
}

export interface CharacterProfilePicture {
  name?: string | null;
  image?: string | null;
}

export interface CastWorkReference {
  id: number;
  actor_id: number | string | null;
  character_name?: string | null;
  note?: string | null;
  voice_actor?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    profile_picture?: string | null;
    note?: string | null;
  } | null;
}

export interface DisplayCastActor {
  id: number | string;
  actorId?: number;
  name?: string;
  character?: string | null;
  profile_path?: string | null;
  roles?: Array<{ character: string; episode_count?: number }>;
  voiceActor?: CastWorkReference["voice_actor"];
  characterImage?: string | null;
  workCharacterName?: string | null;
}

export interface CastWorkMatchResult<
  Actor extends CastActorReference,
  Work extends CastWorkReference,
> {
  matches: Array<{ actor: Actor; works: Work[] }>;
  unmatchedWorks: Work[];
}

export function sameMediaId(
  left: number | string | null | undefined,
  right: number | string | null | undefined,
): boolean {
  return (
    left !== null &&
    left !== undefined &&
    right !== null &&
    right !== undefined &&
    String(left) === String(right)
  );
}

export function matchCastWorks<
  Actor extends CastActorReference,
  Work extends CastWorkReference,
>(actors: Actor[], works: Work[]): CastWorkMatchResult<Actor, Work> {
  const matchedWorkIds = new Set<number>();
  const matches = actors.map((actor) => {
    const actorWorks = works.filter((work) =>
      sameMediaId(work.actor_id, actor.id),
    );
    actorWorks.forEach((work) => matchedWorkIds.add(work.id));
    return { actor, works: actorWorks };
  });

  return {
    matches,
    unmatchedWorks: works.filter((work) => !matchedWorkIds.has(work.id)),
  };
}
