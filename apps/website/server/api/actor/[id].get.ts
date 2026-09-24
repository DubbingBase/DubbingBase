import { useTmdbClient } from "../../utils";
import { getWorkByActor } from "../../utils/db/queries";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";
import { setPublicCacheHeaders } from "../../utils/cache/http";

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

function getStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const property = value[key];
  return typeof property === "string" || property === null
    ? property
    : undefined;
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
) {
  try {
    const workData = await getWorkByActor(actorId);
    if (!workData.length) return [];

    // Deduplicate media details requests
    const mediaKeySet = new Set<string>();
    const uniqueMediaItems: Array<{ contentId: number; contentType: string }> =
      [];
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

    // Fetch unique media details in concurrency-limited batches
    const mediaMap = new Map<string, any>();
    const BATCH_SIZE = 15;
    for (let i = 0; i < uniqueMediaItems.length; i += BATCH_SIZE) {
      const batch = uniqueMediaItems.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ contentId, contentType }) => {
          try {
            const details = await tmdbClient.fetchMediaDetails(
              contentId,
              contentType,
              acceptLanguage,
            );
            return { key: `${contentType}:${contentId}`, details };
          } catch (err) {
            console.error(
              `Error fetching TMDB media ${contentType}:${contentId}:`,
              err,
            );
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
      const mediaDetails =
        cId && cType ? mediaMap.get(`${cType}:${cId}`) : null;

      return {
        ...work,
        voice_actors: voice_actors
          ? [
              {
                ...voice_actors,
                profile_picture: buildSupabaseImageUrl(
                  (voice_actors as any).profile_picture,
                ),
              },
            ]
          : [],
        mediaDetails: mediaDetails
          ? {
              id: mediaDetails.id,
              title: mediaDetails.title || mediaDetails.name,
              original_title:
                mediaDetails.original_title || mediaDetails.original_name,
              poster_path: buildTmdbImageUrl(mediaDetails.poster_path),
              release_date:
                mediaDetails.release_date || mediaDetails.first_air_date,
              media_type: work.dubbing_projects?.content_type || "",
              overview: mediaDetails.overview,
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

  setPublicCacheHeaders(event, "detail");

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const tmdbClient = useTmdbClient();

  try {
    const [actor, voiceRoles] = await Promise.all([
      getActor(actorId, tmdbClient, acceptLanguage),
      getVoiceRoles(actorId, tmdbClient, acceptLanguage),
    ]);

    if (!actor) {
      throw createError({ statusCode: 404, message: "Actor not found" });
    }

    const actorCredits = [
      ...getCastMembers(actor.movie_credits).map((x) => ({
        ...x,
        media_type: "movie",
      })),
      ...getCastMembers(actor.tv_credits).map((x) => ({
        ...x,
        media_type: "tv",
      })),
    ].map((castMember) => ({
      ...castMember,
      profile_path: buildTmdbImageUrl(castMember.profile_path),
      poster_path: buildTmdbImageUrl(castMember.poster_path),
      backdrop_path: buildTmdbImageUrl(castMember.backdrop_path),
    }));

    return {
      actor: {
        ...actor,
        profile_path: buildTmdbImageUrl(
          getStringProperty(actor, "profile_path"),
        ),
        credits: {
          cast: actorCredits,
        },
        voice_roles: voiceRoles,
      },
      voiceActors: voiceRoles,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("Error in actor route:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
