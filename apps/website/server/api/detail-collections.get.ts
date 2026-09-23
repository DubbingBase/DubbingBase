import type { PaginatedResponse } from "@app/shared-logic";
import { setPublicCacheHeaders } from "../utils/cache/http";
import { paginateArray } from "../utils/pagination";

type DetailPayload = Record<string, any>;
type CollectionItem = Record<string, any>;

const COLLECTIONS = new Set([
  "media-cast",
  "actor-filmography",
  "actor-voice-actors",
  "voice-actor-works",
  "studio-projects",
  "studio-voice-actors",
]);

function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return queryValue(value[0]);
  return typeof value === "string" ? value : undefined;
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

function searchMatch(item: CollectionItem, query: string): boolean {
  if (!query) return true;
  return [
    item.name,
    item.title,
    item.character,
    item.character_name,
    item.performance,
    item.note,
    item.voiceActor?.firstname,
    item.voiceActor?.lastname,
    item.firstname,
    item.lastname,
    item.media?.title,
    item.media?.name,
    item.data?.character,
    item.data?.actor?.name,
    item.work?.performance,
  ].some((value) => normalized(value).includes(query));
}

function selectedProject(
  projects: CollectionItem[],
  projectId: unknown,
): CollectionItem | undefined {
  const requestedId = queryValue(projectId);
  if (requestedId) {
    return projects.find((project) => String(project.id) === requestedId);
  }
  return projects[0];
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
  const voiceActor = work.voice_actor || work.voice_actors;
  return voiceActor ? { ...voiceActor, note: work.note } : null;
}

function formatWorkCards(
  project: CollectionItem | undefined,
): CollectionItem[] {
  const works = project?.works || project?.work || [];
  return works.map((work: CollectionItem) => {
    const voiceActor = workVoiceActor(work);
    return {
      work_id: work.id,
      voice_actor_id: voiceActor?.id || work.voice_actor_id,
      firstname: voiceActor?.firstname || "",
      lastname: voiceActor?.lastname || "",
      character_name: work.character_name || "",
      performance: work.performance || "",
      note: work.note || "",
      profile_picture: voiceActor?.profile_picture || null,
    };
  });
}

function formatTmdbCards(
  detail: DetailPayload,
  project: CollectionItem | undefined,
): CollectionItem[] {
  const media = detail.movie || detail.serie || detail.episode || {};
  const cast = detail.aggregateCredits?.cast || media.credits?.cast || [];
  const works = project?.works || [];
  const matchedWorkIds = new Set<number>();
  const cards: CollectionItem[] = [];

  for (const actor of cast) {
    const actorWorks = works.filter((work: CollectionItem) => {
      const matches = String(work.actor_id) === String(actor.id);
      if (matches) matchedWorkIds.add(work.id);
      return matches;
    });
    if (actorWorks.length === 0) continue;

    for (const work of actorWorks) {
      const characterName = actor.character || work?.character_name || null;
      const characterPicture = (detail.characterProfilePictures || []).find(
        (picture: CollectionItem) =>
          normalized(picture.name) === normalized(characterName),
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

function formatGameCards(
  detail: DetailPayload,
  project: CollectionItem | undefined,
): CollectionItem[] {
  const works = project?.works || [];
  const characters = detail.characters || [];
  const matchedWorkIds = new Set<number>();
  const cards = characters.flatMap((character: CollectionItem) => {
    const mappedCharacterId = 9_000_000_000 + Number(character.id);
    const fallbackCharacterId =
      Math.abs(
        String(character.name || "")
          .split("")
          .reduce(
            (hash: number, value: string) =>
              (hash * 31 + value.charCodeAt(0)) | 0,
            0,
          ),
      ) + 8_000_000_000;
    const characterIds = new Set([
      String(character.id),
      String(mappedCharacterId),
      String(fallbackCharacterId),
    ]);
    const matchingWorks = works.filter((work: CollectionItem) => {
      const matches =
        characterIds.has(String(work.character_id)) ||
        characterIds.has(String(work.actor_id));
      if (matches) matchedWorkIds.add(work.id);
      return matches;
    });
    const cardsForCharacter = matchingWorks.length > 0 ? matchingWorks : [null];
    return cardsForCharacter.map((work: CollectionItem | null) => ({
      ...character,
      id: work ? `${character.id}-${work.id}` : character.id,
      work_id: work?.id,
      voiceActor: work ? workVoiceActor(work) : null,
    }));
  });

  return [
    ...cards,
    ...works
      .filter((work: CollectionItem) => !matchedWorkIds.has(work.id))
      .map((work: CollectionItem) => ({
        id: `work-${work.id}`,
        work_id: work.id,
        name: work.character_name || "Unknown character",
        mug_shot: null,
        voiceActor: workVoiceActor(work),
      })),
  ];
}

async function getMediaCast(
  event: any,
  query: Record<string, any>,
): Promise<CollectionItem[]> {
  const type = queryValue(query.type) || "";
  const id = requiredId(query.id, "id");
  const requestFetch = event.$fetch;
  const detailQuery =
    type === "episode"
      ? {
          id,
          season_number: requiredSeasonNumber(query.seasonNumber),
          episode_number: requiredId(query.episodeNumber, "episodeNumber"),
        }
      : undefined;
  const detail = await requestFetch(
    type === "episode" ? "/api/episode" : mediaEndpoint(type, id),
    { query: detailQuery },
  );
  const projects = detail.dubbingProjects || [];
  const project = selectedProject(projects, query.projectId);

  if (["audiobook", "podcast", "advertisement", "toy"].includes(type)) {
    return formatWorkCards(project);
  }
  if (type === "game") return formatGameCards(detail, project);
  return formatTmdbCards(detail, project);
}

async function getCollectionItems(
  event: any,
  query: Record<string, any>,
): Promise<CollectionItem[]> {
  const collection = queryValue(query.collection) || "";
  const id = ["studio-projects", "studio-voice-actors"].includes(collection)
    ? requiredTextId(query.id, "id")
    : requiredId(query.id, "id");
  const requestFetch = event.$fetch;

  switch (collection) {
    case "media-cast":
      return await getMediaCast(event, query);
    case "actor-filmography": {
      const detail = await requestFetch(`/api/actor/${id}`);
      const roles = detail.actor?.voice_roles || [];
      return (detail.actor?.credits?.cast || []).map(
        (item: CollectionItem) => ({
          ...item,
          voice_actors: roles
            .filter(
              (role: CollectionItem) =>
                String(role.mediaDetails?.id) === String(item.id) &&
                (!queryValue(query.language) ||
                  queryValue(query.language) === "all" ||
                  role.dubbing_projects?.language ===
                    queryValue(query.language)),
            )
            .flatMap((role: CollectionItem) => role.voice_actors || []),
        }),
      );
    }
    case "actor-voice-actors": {
      const detail = await requestFetch(`/api/actor/${id}`);
      const roles = detail.actor?.voice_roles || [];
      const voiceActors = new Map<number, CollectionItem>();
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
        (left, right) => right.rolesCount - left.rolesCount,
      );
    }
    case "voice-actor-works": {
      const lang = queryValue(query.lang);
      const detail = await requestFetch(
        `/api/voice-actor/${id}`,
        lang ? { query: { lang } } : undefined,
      );
      let works = detail.enhancedWorks || [];
      const category = queryValue(query.category);
      if (category && category !== "all") {
        works = works.filter(
          (item: CollectionItem) =>
            normalized(item.work?.dubbing_projects?.content_type) ===
            normalized(category),
        );
      }
      const text = normalized(queryValue(query.query));
      works = works.filter((item: CollectionItem) => searchMatch(item, text));
      works.sort((left: CollectionItem, right: CollectionItem) => {
        const leftDate = left.sortDate || "9999-12-31";
        const rightDate = right.sortDate || "9999-12-31";
        return queryValue(query.sort) === "oldest"
          ? leftDate.localeCompare(rightDate)
          : rightDate.localeCompare(leftDate);
      });
      return works;
    }
    case "studio-projects": {
      const detail = await requestFetch(`/api/get-studio-details`, {
        query: { studioId: id },
      });
      const text = normalized(queryValue(query.query));
      return (detail.dubbedProjects || []).filter((item: CollectionItem) =>
        searchMatch(item, text),
      );
    }
    case "studio-voice-actors": {
      const detail = await requestFetch(`/api/get-studio-details`, {
        query: { studioId: id },
      });
      return detail.voiceActorsRoster || [];
    }
    default:
      throw createError({ statusCode: 400, message: "Invalid collection" });
  }
}

export default defineEventHandler(
  async (event): Promise<PaginatedResponse<CollectionItem>> => {
    const query = getQuery(event);
    const collection = queryValue(query.collection) || "";
    if (!COLLECTIONS.has(collection)) {
      throw createError({ statusCode: 400, message: "Invalid collection" });
    }

    const hasFilter = Boolean(
      queryValue(query.query) ||
      queryValue(query.projectId) ||
      queryValue(query.category) ||
      queryValue(query.language) ||
      queryValue(query.lang) ||
      queryValue(query.sort) ||
      queryValue(query.view),
    );
    setPublicCacheHeaders(event, hasFilter ? "search" : "detail");

    const items = await getCollectionItems(event, query);
    const filteredItems = items.filter((item) =>
      searchMatch(item, normalized(queryValue(query.query))),
    );
    const result = paginateArray(filteredItems, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.items,
      pagination: result.pagination,
    };
  },
);
