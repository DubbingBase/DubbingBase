export type VoiceActorWorkLike = {
  work?: { actor_id?: number | null } | null;
  data?: {
    actor?: {
      id?: number | null;
      name?: string | null;
      profile_picture?: string | null;
    } | null;
  } | null;
};

export type VoiceActorWorkGroup<T extends VoiceActorWorkLike> = {
  key: string;
  actorId: number | null;
  actor: {
    id: number | null;
    name: string | null;
    profile_picture: string | null;
  };
  works: T[];
  worksCount: number;
};

export type VoiceActorWorksPageItem<T extends VoiceActorWorkLike> =
  T | VoiceActorWorkGroup<T>;

function positiveActorId(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function groupVoiceActorWorks<T extends VoiceActorWorkLike>(
  works: readonly T[],
): VoiceActorWorkGroup<T>[] {
  const groups = new Map<string, VoiceActorWorkGroup<T>>();

  for (const work of works) {
    const actorId =
      positiveActorId(work.work?.actor_id) ??
      positiveActorId(work.data?.actor?.id);
    const key = actorId === null ? "actor:unknown" : `actor:${actorId}`;
    const actorName = work.data?.actor?.name?.trim() || null;
    const profilePicture = work.data?.actor?.profile_picture || null;
    const group = groups.get(key);

    if (group) {
      group.works.push(work);
      group.worksCount += 1;
      if (actorId !== null) {
        if (!group.actor.name && actorName) group.actor.name = actorName;
        if (!group.actor.profile_picture && profilePicture) {
          group.actor.profile_picture = profilePicture;
        }
      }
      continue;
    }

    groups.set(key, {
      key,
      actorId,
      actor: {
        id: actorId,
        name: actorId === null ? null : actorName,
        profile_picture: actorId === null ? null : profilePicture,
      },
      works: [work],
      worksCount: 1,
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    const countOrder = right.worksCount - left.worksCount;
    if (countOrder !== 0) return countOrder;

    if (left.actorId === null && right.actorId !== null) return 1;
    if (left.actorId !== null && right.actorId === null) return -1;

    const nameOrder = (left.actor.name || "").localeCompare(
      right.actor.name || "",
    );
    if (nameOrder !== 0) return nameOrder;

    return (left.actorId || 0) - (right.actorId || 0);
  });
}

export function paginateVoiceActorWorks<T extends VoiceActorWorkLike>(
  works: readonly T[],
  view: "grouped" | "list",
  page: number,
  pageSize: number,
): {
  data: VoiceActorWorksPageItem<T>[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
} {
  const items = view === "grouped" ? groupVoiceActorWorks(works) : works;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page: currentPage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}
