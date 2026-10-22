import type { PaginatedResponse } from "../types";
import type { IgdbCharacter } from "../types";

export type DetailCollection =
  | "media-cast"
  | "actor-filmography"
  | "actor-voice-actors"
  | "studio-projects"
  | "studio-voice-actors";

export type DetailCollectionParams = {
  collection: DetailCollection;
  id: string | number;
  type?: string;
  projectId?: string | number;
  seasonNumber?: string | number;
  episodeNumber?: string | number;
  query?: string;
  category?: string;
  sort?: string;
  view?: string;
  language?: string;
  lang?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type DetailCollectionProject = {
  id: number;
  language?: string | null;
  works?: Array<{
    id: number;
    voice_actor?: { id: number } | null;
  }>;
};

type DetailRecord = Record<string, unknown>;
type DetailVoiceActor = DetailRecord & {
  id?: number;
  firstname?: string;
  lastname?: string;
  profile_picture?: string | null;
  performance?: string | null;
  note?: string | null;
};

export type MediaWorkCastCard = {
  work_id: number;
  voice_actor_id?: number;
  firstname: string;
  lastname: string;
  character_name: string;
  performance: string;
  note: string;
  profile_picture: string | null;
};

export type GameDetailCastCard = {
  id: number | string;
  name: string;
  mug_shot?: { url?: string | null } | null;
  work_id?: number;
  voiceActor: DetailVoiceActor | null;
};

function isDetailRecord(value: unknown): value is DetailRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return true;
}

function asRecord(value: unknown): DetailRecord | undefined {
  return isDetailRecord(value) ? value : undefined;
}

function asRecords(value: unknown): DetailRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
      })
    : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function projectWorks(project: unknown): DetailRecord[] {
  const record = asRecord(project);
  return asRecords(record?.works || record?.work || []);
}

function workVoiceActor(work: DetailRecord): DetailVoiceActor | undefined {
  const voiceActor = asRecord(work.voice_actor || work.voice_actors);
  if (!voiceActor) return undefined;
  return {
    ...voiceActor,
    ...(typeof voiceActor.id === "number" ? { id: voiceActor.id } : {}),
    ...(typeof voiceActor.firstname === "string" ? { firstname: voiceActor.firstname } : {}),
    ...(typeof voiceActor.lastname === "string" ? { lastname: voiceActor.lastname } : {}),
    ...(typeof voiceActor.profile_picture === "string" || voiceActor.profile_picture === null
      ? { profile_picture: voiceActor.profile_picture }
      : {}),
    ...(typeof voiceActor.performance === "string" || voiceActor.performance === null
      ? { performance: voiceActor.performance }
      : {}),
    ...(typeof work.note === "string" || work.note === null ? { note: work.note } : {}),
  };
}

export function selectDetailCollectionProject<T>(
  projects: readonly T[],
  projectId: unknown,
): T | undefined {
  const rawId = Array.isArray(projectId) ? projectId[0] : projectId;
  const requestedId =
    typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : undefined;
  if (requestedId) {
    return projects.find((project) => {
      const id = asRecord(project)?.id;
      return id !== undefined && String(id) === requestedId;
    });
  }
  return projects[0];
}

export function resolveDetailCollectionProject<T>(
  projects: readonly T[],
  projectId: unknown,
): T | undefined {
  return selectDetailCollectionProject(projects, projectId) ?? projects[0];
}

export function formatMediaWorkCastCards(project: unknown): MediaWorkCastCard[] {
  return projectWorks(project).map((work) => {
    const voiceActor = workVoiceActor(work);
    const voiceActorId = numberValue(voiceActor?.id) || numberValue(work.voice_actor_id);
    return {
      work_id: numberValue(work.id) ?? 0,
      ...(voiceActorId === undefined ? {} : { voice_actor_id: voiceActorId }),
      firstname: stringValue(voiceActor?.firstname) || "",
      lastname: stringValue(voiceActor?.lastname) || "",
      character_name: stringValue(work.character_name) || "",
      performance: stringValue(work.performance) || "",
      note: stringValue(work.note) || "",
      profile_picture: stringValue(voiceActor?.profile_picture) || null,
    };
  });
}

export function formatGameDetailCastCards(
  characters: readonly IgdbCharacter[],
  project: unknown,
): GameDetailCastCard[] {
  const works = projectWorks(project);
  const matchedWorkIds = new Set<unknown>();
  const cards = characters.flatMap((character) => {
    const mappedCharacterId = 9_000_000_000 + Number(character.id);
    const fallbackCharacterId =
      Math.abs(
        String(character.name || "")
          .split("")
          .reduce((hash, value) => (hash * 31 + value.charCodeAt(0)) | 0, 0),
      ) + 8_000_000_000;
    const characterIds = new Set([
      String(character.id),
      String(mappedCharacterId),
      String(fallbackCharacterId),
    ]);
    const matchingWorks = works.filter((work) => {
      const matches =
        characterIds.has(String(work.character_id)) || characterIds.has(String(work.actor_id));
      if (matches) matchedWorkIds.add(work.id);
      return matches;
    });
    const cardsForCharacter = matchingWorks.length > 0 ? matchingWorks : [null];
    return cardsForCharacter.map((work) => ({
      ...character,
      id: work ? `${character.id}-${String(work.id)}` : character.id,
      name: character.name,
      ...(work && numberValue(work.id) !== undefined ? { work_id: numberValue(work.id) } : {}),
      voiceActor: work ? formatGameVoiceActor(work) : null,
    }));
  });

  return [
    ...cards,
    ...works
      .filter((work) => !matchedWorkIds.has(work.id))
      .map((work) => ({
        id: `work-${String(work.id)}`,
        name: stringValue(work.character_name) || "Unknown character",
        mug_shot: null,
        ...(numberValue(work.id) !== undefined ? { work_id: numberValue(work.id) } : {}),
        voiceActor: formatGameVoiceActor(work),
      })),
  ];
}

function formatGameVoiceActor(work: DetailRecord): GameDetailCastCard["voiceActor"] {
  return workVoiceActor(work) ?? null;
}

function recordField(record: DetailRecord | undefined, key: string): unknown {
  return record?.[key];
}

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function matchesDetailCollectionSearch(item: unknown, query: unknown): boolean {
  const text = normalized(query);
  if (!text) return true;

  const record = asRecord(item);
  if (!record) return false;
  const voiceActor = asRecord(record.voiceActor);
  const media = asRecord(record.media);
  const data = asRecord(record.data);
  const actor = asRecord(data?.actor);
  const work = asRecord(record.work);
  const values = [
    record.name,
    record.title,
    record.character,
    record.character_name,
    record.performance,
    record.note,
    recordField(voiceActor, "firstname"),
    recordField(voiceActor, "lastname"),
    record.firstname,
    record.lastname,
    recordField(media, "title"),
    recordField(media, "name"),
    recordField(data, "character"),
    recordField(actor, "name"),
    recordField(work, "performance"),
  ];
  return values.some((value) => normalized(value).includes(text));
}

export function filterDetailCollectionItems<T>(items: readonly T[], query: unknown): T[] {
  return items.filter((item) => matchesDetailCollectionSearch(item, query));
}

export function paginateDetailCollection<T>(items: readonly T[], page: number, pageSize = 12): T[] {
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  return items.slice(start, start + safePageSize);
}

export async function fetchDetailCollection<T>(
  params: DetailCollectionParams,
): Promise<PaginatedResponse<T>> {
  return await $fetch<PaginatedResponse<T>>("/api/detail-collections", {
    query: params,
  });
}
