import { useTmdbClient } from "../../utils";
import { getWorkByActor } from "../../utils/db/queries";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import { actorPageResponse } from "../../utils/actor-page-response";
type TmdbCastMember = Record<string, unknown> & {
  profile_path?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isTmdbCastMember(value: unknown): value is TmdbCastMember {
  return (
    isRecord(value) &&
    isOptionalString(value.profile_path) &&
    isOptionalString(value.poster_path) &&
    isOptionalString(value.backdrop_path)
  );
}

function getCastMembers(value: unknown): TmdbCastMember[] {
  if (!isRecord(value) || !Array.isArray(value.cast)) return [];
  return value.cast.filter(isTmdbCastMember);
}

function getActorPageCredits(value: unknown, mediaType: "movie" | "tv") {
  return getCastMembers(value).map((credit) => ({
    id: credit.id,
    title: credit.title,
    name: credit.name,
    original_title: credit.original_title,
    original_name: credit.original_name,
    character: credit.character,
    poster_path: buildTmdbImageUrl(credit.poster_path),
    release_date: credit.release_date,
    first_air_date: credit.first_air_date,
    media_type: mediaType,
  }));
}

function getStringProperty(value: Record<string, unknown>, key: string): string | null | undefined {
  const property = value[key];
  return typeof property === "string" || property === null ? property : undefined;
}

function getNumberProperty(value: Record<string, unknown>, key: string): number | undefined {
  const property = value[key];
  return typeof property === "number" ? property : undefined;
}

function hasStatusCode(value: unknown): value is { statusCode: number } {
  return isRecord(value) && typeof value.statusCode === "number";
}

async function getActor(
  actorId: number,
  tmdbClient: ReturnType<typeof useTmdbClient>,
  acceptLanguage?: string,
) {
  try {
    return await tmdbClient.getPersonWithCredits(actorId, acceptLanguage);
  } catch (e) {
    console.error("Error fetching actor details:", e);
    return null;
  }
}

async function getVoiceRoles(
  actorId: number,
  tmdbClient: ReturnType<typeof useTmdbClient>,
  acceptLanguage?: string,
  personRequest?: ReturnType<typeof getActor>,
) {
  try {
    const workData = await getWorkByActor(actorId);
    if (!workData.length) return [];

    // Deduplicate media details requests
    const mediaKeySet = new Set<string>();
    const uniqueMediaItems: Array<{ contentId: number; contentType: string }> = [];
    for (const row of workData) {
      const cId = row.dubbing_projects?.content_id;
      const cType = row.dubbing_projects?.content_type;
      if (cId && cType) {
        const key = `${cType}:${cId}`;
        if (!mediaKeySet.has(key)) {
          mediaKeySet.add(key);
          uniqueMediaItems.push({ contentId: cId, contentType: cType });
        }
      }
    }

    // Person credits already contain media summaries. Reuse complete entries
    // on actor pages, and fetch only titles missing from those credits.
    const mediaMap = new Map<string, Record<string, unknown>>();
    const person = personRequest ? await personRequest : null;
    if (person) {
      const groups: Array<{ contentType: "movie" | "tv"; cast: TmdbCastMember[] }> = [
        { contentType: "movie", cast: getCastMembers(person.movie_credits) },
        { contentType: "tv", cast: getCastMembers(person.tv_credits) },
      ];
      for (const { contentType, cast } of groups) {
        const fields =
          contentType === "movie"
            ? ["title", "original_title", "release_date", "overview"]
            : ["name", "original_name", "first_air_date", "overview"];
        for (const credit of cast) {
          const id = getNumberProperty(credit, "id");
          if (id === undefined) continue;
          const key = `${contentType}:${id}`;
          if (!mediaKeySet.has(key) || !fields.every((field) => typeof credit[field] === "string"))
            continue;
          if (credit.poster_path !== null && typeof credit.poster_path !== "string") continue;
          mediaMap.set(key, credit);
        }
      }
    }

    // Fetch unique missing media details in concurrency-limited batches.
    const missingMediaItems = uniqueMediaItems.filter(
      ({ contentId, contentType }) => !mediaMap.has(`${contentType}:${contentId}`),
    );
    const BATCH_SIZE = 15;
    for (let i = 0; i < missingMediaItems.length; i += BATCH_SIZE) {
      const batch = missingMediaItems.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ contentId, contentType }) => {
          try {
            const details = await tmdbClient.fetchMediaSummary(
              contentId,
              contentType,
              acceptLanguage,
            );
            return { key: `${contentType}:${contentId}`, details };
          } catch (err) {
            console.error(`Error fetching TMDB media ${contentType}:${contentId}:`, err);
            return { key: `${contentType}:${contentId}`, details: null };
          }
        }),
      );
      for (const res of results) {
        if (res.details) {
          mediaMap.set(res.key, res.details);
        }
      }
    }

    const voiceRoles = workData.map((row) => {
      const { voice_actors, ...work } = row;
      const cId = work.dubbing_projects?.content_id;
      const cType = work.dubbing_projects?.content_type;
      const mediaDetails = cId && cType ? mediaMap.get(`${cType}:${cId}`) : null;

      return {
        ...work,
        voice_actors: voice_actors
          ? [
              {
                ...voice_actors,
                profile_picture: buildSupabaseImageUrl(voice_actors.profile_picture),
              },
            ]
          : [],
        mediaDetails: mediaDetails
          ? {
              id: getNumberProperty(mediaDetails, "id"),
              title:
                getStringProperty(mediaDetails, "title") || getStringProperty(mediaDetails, "name"),
              original_title:
                getStringProperty(mediaDetails, "original_title") ||
                getStringProperty(mediaDetails, "original_name"),
              poster_path: buildTmdbImageUrl(getStringProperty(mediaDetails, "poster_path")),
              release_date:
                getStringProperty(mediaDetails, "release_date") ||
                getStringProperty(mediaDetails, "first_air_date"),
              media_type: work.dubbing_projects?.content_type || "",
              overview: getStringProperty(mediaDetails, "overview"),
            }
          : null,
      };
    });

    return voiceRoles;
  } catch (e) {
    console.error("Error fetching voice roles:", e);
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const actorId = parseInt(id, 10);
  if (isNaN(actorId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const tmdbClient = useTmdbClient();
  const projection = getQuery(event).projection;

  try {
    const personRequest = getActor(actorId, tmdbClient, acceptLanguage);
    const [actor, voiceRoles] = await Promise.all([
      personRequest,
      getVoiceRoles(
        actorId,
        tmdbClient,
        acceptLanguage,
        projection === "actor-page" ? personRequest : undefined,
      ),
    ]);

    if (!actor) {
      throw createError({ statusCode: 404, message: "Actor not found" });
    }

    if (projection === "actor-page") {
      const actorCredits = [
        ...getActorPageCredits(actor.movie_credits, "movie"),
        ...getActorPageCredits(actor.tv_credits, "tv"),
      ];

      return actorPageResponse(
        actor,
        actorCredits,
        voiceRoles,
        buildTmdbImageUrl(getStringProperty(actor, "profile_path")),
      );
    }

    const actorCredits = [
      ...getCastMembers(actor.movie_credits).map((credit) => ({
        ...credit,
        media_type: "movie",
      })),
      ...getCastMembers(actor.tv_credits).map((credit) => ({
        ...credit,
        media_type: "tv",
      })),
    ].map((castMember) => ({
      ...castMember,
      profile_path: buildTmdbImageUrl(castMember.profile_path),
      poster_path: buildTmdbImageUrl(castMember.poster_path),
      backdrop_path: buildTmdbImageUrl(castMember.backdrop_path),
    }));

    const response = {
      actor: {
        ...actor,
        profile_path: buildTmdbImageUrl(getStringProperty(actor, "profile_path")),
        credits: {
          cast: actorCredits,
        },
        voice_roles: voiceRoles,
      },
      voiceActors: voiceRoles,
    };
    return response;
  } catch (error: unknown) {
    if (hasStatusCode(error)) throw error;
    console.error("Error in actor route:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
