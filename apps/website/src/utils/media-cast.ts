export const MEDIA_CAST_PAGE_SIZE = 48;

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
  voice_actor_id?: number | null;
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

export type MediaProjectView<Project> =
  | { kind: "original"; key: "original"; language: string }
  | { kind: "dubbing"; key: number; project: Project };

export function hasOriginalVersion(
  language: string | null | undefined,
  cast: readonly CastActorReference[] | null | undefined,
): language is string {
  return Boolean(language?.trim() && cast?.length);
}

export function isOriginalVersionQuery(value: unknown): boolean {
  return value === "original" || (Array.isArray(value) && value[0] === "original");
}

export function originalVersionCast<Actor extends CastActorReference>(
  actors: Actor[],
): DisplayCastActor[] {
  return actors.map((actor) => ({
    ...actor,
    actorId: actor.id,
    profile_path: actor.profile_path?.startsWith("/")
      ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
      : actor.profile_path,
    voiceActor: null,
  }));
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

export function matchCastWorks<Actor extends CastActorReference, Work extends CastWorkReference>(
  actors: Actor[],
  works: Work[],
): CastWorkMatchResult<Actor, Work> {
  const actorIds = new Set(actors.map((actor) => String(actor.id)));
  const worksByActorId = new Map<string, Work[]>();
  const matchedWorkIds = new Set<number>();

  for (const work of works) {
    if (work.actor_id === null) continue;

    const actorId = String(work.actor_id);
    if (!actorIds.has(actorId)) continue;

    const actorWorks = worksByActorId.get(actorId);
    if (actorWorks) {
      actorWorks.push(work);
    } else {
      worksByActorId.set(actorId, [work]);
    }
    matchedWorkIds.add(work.id);
  }

  const matches = actors.map((actor) => {
    return {
      actor,
      works: worksByActorId.get(String(actor.id))?.slice() ?? [],
    };
  });

  return {
    matches,
    unmatchedWorks: works.filter((work) => !matchedWorkIds.has(work.id)),
  };
}
