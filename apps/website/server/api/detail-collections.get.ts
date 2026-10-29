import type { PaginatedResponse } from "@app/shared-logic";
import {
  filterDetailCollectionItems,
  formatGameDetailCastCards,
  formatMediaWorkCastCards,
  selectDetailCollectionProject,
} from "@app/shared-logic";
import type { IgdbCharacter } from "@app/shared-logic";
import type { H3Event$Fetch } from "nitropack/types";
import { paginateArray } from "../utils/pagination";

type CollectionItem = {
  id?: number | string;
  actorId?: number | string;
  actor_id?: number | string | null;
  character_id?: number | string | null;
  character_name?: string | null;
  character?: string | null;
  characterImage?: string | null;
  title?: string | null;
  original_title?: string | null;
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  profile_picture?: string | null;
  profile_path?: string | null;
  image?: string | null;
  note?: string | null;
  performance?: string | null;
  work_id?: number | string;
  workCharacterName?: string | null;
  rolesCount?: number;
  voiceActor?: Record<string, unknown> | null;
  voice_actor?: CollectionItem | null;
  voice_actors?: CollectionItem[] | CollectionItem | null;
  works?: CollectionItem[];
  work?: { performance?: string | null } | null;
  credits?: { cast?: CollectionItem[] } | null;
  media?: { title?: string | null; name?: string | null } | null;
  data?: {
    character?: string | null;
    actor?: { name?: string | null } | null;
  } | null;
};

type VoiceActorRecord = CollectionItem & {
  id: number;
};

type ActorVoiceRole = {
  mediaDetails?: { id: number } | null;
  voice_actors?: VoiceActorRecord[];
  dubbing_projects?: { language?: string | null } | null;
};

type DetailPayload = {
  movie?: CollectionItem | null;
  serie?: CollectionItem | null;
  episode?: CollectionItem | null;
  aggregateCredits?: { cast?: CollectionItem[] } | null;
  characterProfilePictures?: CollectionItem[];
  dubbingProjects?: CollectionItem[];
  characters?: IgdbCharacter[];
  actor?: {
    credits?: { cast?: CollectionItem[] };
    voice_roles?: ActorVoiceRole[];
  };
  dubbedProjects?: CollectionItem[];
  voiceActorsRoster?: CollectionItem[];
};

type CollectionQuery = Record<string, string | string[] | undefined>;

const COLLECTIONS = new Set([
  "media-cast",
  "actor-filmography",
  "actor-voice-actors",
  "studio-projects",
  "studio-voice-actors",
]);

function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return queryValue(value[0]);
  return typeof value === "string" ? value : undefined;
}

function collectionQuery(value: unknown): CollectionQuery {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: CollectionQuery = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    } else if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      result[key] = entry;
    }
  }
  return result;
}

function requiredId(value: unknown, name: string): number {
  const raw = queryValue(value)?.trim();
  const parsed = Number(raw);
  if (!raw || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, message: `Invalid ${name}` });
  }
  return parsed;
}

function requiredSeasonNumber(value: unknown): number {
  const raw = queryValue(value)?.trim();
  const parsed = Number(raw);
  if (!raw || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, message: "Invalid seasonNumber" });
  }
  return parsed;
}

function requiredTextId(value: unknown, name: string): string {
  const parsed = queryValue(value)?.trim();
  if (!parsed || parsed.length > 200) {
    throw createError({ statusCode: 400, message: `Invalid ${name}` });
  }
  return parsed;
}

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function mediaEndpoint(type: string, id: number): string {
  switch (type) {
    case "movie":
      return `/api/movie/${id}`;
    case "show":
      return `/api/show/${id}`;
    case "game":
      return `/api/game/${id}`;
    case "audiobook":
      return `/api/audiobook/${id}`;
    case "podcast":
      return `/api/podcast/${id}`;
    case "advertisement":
      return `/api/advertisement/${id}`;
    case "toy":
      return `/api/toy/${id}`;
    default:
      throw createError({ statusCode: 400, message: "Invalid media type" });
  }
}

function workVoiceActor(work: CollectionItem): CollectionItem | null {
  const voiceActor =
    work.voice_actor || (Array.isArray(work.voice_actors) ? null : work.voice_actors);
  return voiceActor ? { ...voiceActor, note: work.note } : null;
}

function formatTmdbCards(
  detail: DetailPayload,
  project: CollectionItem | undefined,
): CollectionItem[] {
  const media: CollectionItem = detail.movie || detail.serie || detail.episode || {};
  const cast = detail.aggregateCredits?.cast || media.credits?.cast || [];
  const works = project?.works || [];
  const worksByActorId = new Map<string, CollectionItem[]>();
  for (const work of works) {
    const actorId = String(work.actor_id);
    const actorWorks = worksByActorId.get(actorId);
    if (actorWorks) actorWorks.push(work);
    else worksByActorId.set(actorId, [work]);
  }

  const matchedWorkIds = new Set<number | string | undefined>();
  const cards: CollectionItem[] = [];

  for (const actor of cast) {
    const actorWorks = worksByActorId.get(String(actor.id)) || [];
    if (actorWorks.length === 0) continue;

    for (const work of actorWorks) {
      matchedWorkIds.add(work.id);
      const characterName = actor.character || work?.character_name || null;
      const characterPicture = (detail.characterProfilePictures || []).find(
        (picture: CollectionItem) => normalized(picture.name) === normalized(characterName),
      );
      const voiceActor = work ? workVoiceActor(work) : null;
      cards.push({
        ...actor,
        actorId: actor.id,
        id: work ? `${actor.id}-${work.id}` : actor.id,
        work_id: work?.id,
        voiceActor,
        characterImage: characterPicture?.image || null,
        workCharacterName: work?.character_name || null,
      });
    }
  }

  for (const work of works) {
    if (matchedWorkIds.has(work.id)) continue;
    cards.push({
      id: `work-${work.id}`,
      work_id: work.id,
      name: work.character_name || "Unknown character",
      profile_path: null,
      character: work.character_name || null,
      voiceActor: workVoiceActor(work),
      characterImage: null,
      workCharacterName: work.character_name || null,
    });
  }

  return cards;
}

async function getMediaCast(
  requestFetch: H3Event$Fetch,
  query: CollectionQuery,
): Promise<CollectionItem[]> {
  const type = queryValue(query.type) || "";
  const id = requiredId(query.id, "id");
  const detailQuery =
    type === "episode"
      ? {
          id,
          season_number: requiredSeasonNumber(query.seasonNumber),
          episode_number: requiredId(query.episodeNumber, "episodeNumber"),
          projection: "media-page",
        }
      : ["movie", "show"].includes(type)
        ? { projection: "media-page" }
        : undefined;
  const detail = await requestFetch<DetailPayload>(
    type === "episode" ? "/api/episode" : mediaEndpoint(type, id),
    { query: detailQuery },
  );
  const projects = detail.dubbingProjects || [];
  const project = selectDetailCollectionProject<CollectionItem>(projects, query.projectId);

  if (["audiobook", "podcast", "advertisement", "toy"].includes(type)) {
    return formatMediaWorkCastCards(project);
  }
  if (type === "game") {
    return formatGameDetailCastCards(detail.characters || [], project);
  }
  return formatTmdbCards(detail, project);
}

async function getCollectionItems(
  requestFetch: H3Event$Fetch,
  query: CollectionQuery,
): Promise<CollectionItem[]> {
  const collection = queryValue(query.collection) || "";
  const id = ["studio-projects", "studio-voice-actors"].includes(collection)
    ? requiredTextId(query.id, "id")
    : requiredId(query.id, "id");
  switch (collection) {
    case "media-cast":
      return await getMediaCast(requestFetch, query);
    case "actor-filmography": {
      const detail = await requestFetch<DetailPayload>(`/api/actor/${id}`);
      const roles = detail.actor?.voice_roles || [];
      return (detail.actor?.credits?.cast || []).map((item) => ({
        ...item,
        voice_actors: roles
          .filter(
            (role) =>
              String(role.mediaDetails?.id) === String(item.id) &&
              (!queryValue(query.language) ||
                queryValue(query.language) === "all" ||
                role.dubbing_projects?.language === queryValue(query.language)),
          )
          .flatMap((role) => role.voice_actors || []),
      }));
    }
    case "actor-voice-actors": {
      const detail = await requestFetch<DetailPayload>(`/api/actor/${id}`);
      const roles = detail.actor?.voice_roles || [];
      const voiceActors = new Map<number, VoiceActorRecord>();
      for (const role of roles) {
        if (
          queryValue(query.language) &&
          queryValue(query.language) !== "all" &&
          role.dubbing_projects?.language !== queryValue(query.language)
        ) {
          continue;
        }
        for (const voiceActor of role.voice_actors || []) {
          const current = voiceActors.get(voiceActor.id);
          voiceActors.set(voiceActor.id, {
            ...voiceActor,
            rolesCount: (current?.rolesCount || 0) + 1,
          });
        }
      }
      return Array.from(voiceActors.values()).sort(
        (left, right) => (right.rolesCount ?? 0) - (left.rolesCount ?? 0),
      );
    }
    case "studio-projects": {
      const detail = await requestFetch<DetailPayload>(`/api/get-studio-details`, {
        query: { studioId: id },
      });
      const text = normalized(queryValue(query.query));
      return filterDetailCollectionItems(detail.dubbedProjects || [], text);
    }
    case "studio-voice-actors": {
      const detail = await requestFetch<DetailPayload>(`/api/get-studio-details`, {
        query: { studioId: id },
      });
      return detail.voiceActorsRoster || [];
    }
    default:
      throw createError({ statusCode: 400, message: "Invalid collection" });
  }
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<CollectionItem>> => {
  const query = collectionQuery(getQuery(event));
  const collection = queryValue(query.collection) || "";
  if (!COLLECTIONS.has(collection)) {
    throw createError({ statusCode: 400, message: "Invalid collection" });
  }
  const items = await getCollectionItems(event.$fetch, query);
  const filteredItems = filterDetailCollectionItems(items, normalized(queryValue(query.query)));
  const result = paginateArray(filteredItems, {
    page: queryValue(query.page),
    pageSize: queryValue(query.pageSize),
  });

  return {
    data: result.items,
    pagination: result.pagination,
  };
});
