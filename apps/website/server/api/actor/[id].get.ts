import { useCache, useTmdbClient } from "../../utils";
import { getWorkByActor } from "../../utils/db/queries";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import { buildTmdbImageUrl } from "../../utils/urls/tmdb";

async function getActor(
  actorId: number,
  tmdbClient: ReturnType<typeof useTmdbClient>,
  acceptLanguage?: string,
) {
  const cache = useCache();
  const cacheKey = `tmdb:person:${actorId}`;

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    const actorData = await tmdbClient.get(
      `person/${actorId}`,
      { append_to_response: "tv_credits,movie_credits,external_ids" },
      acceptLanguage,
    );
    cache.set(cacheKey, actorData, "MEDIUM").catch(() => {});
    return actorData;
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

    const counts: Record<number, number> = {};
    for (const row of workData) {
      if (!row.voice_actor_id) continue;
      counts[row.voice_actor_id] = (counts[row.voice_actor_id] || 0) + 1;
    }

    const top3 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => parseInt(id, 10));

    const voiceRoles = await Promise.all(
      workData.map(async (row) => {
        const { voice_actors, ...work } = row;
        let mediaDetails = null;

        if (
          work.dubbing_projects?.content_id &&
          work.dubbing_projects?.content_type
        ) {
          mediaDetails = await tmdbClient.fetchMediaDetails(
            work.dubbing_projects.content_id,
            work.dubbing_projects.content_type,
            acceptLanguage,
          );
        }

        return {
          ...work,
          highlight: work.voice_actor_id
            ? top3.includes(work.voice_actor_id)
            : false,
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
      }),
    );

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

  try {
    const [actor, voiceRoles] = await Promise.all([
      getActor(actorId, tmdbClient, acceptLanguage),
      getVoiceRoles(actorId, tmdbClient, acceptLanguage),
    ]);

    if (!actor) {
      throw createError({ statusCode: 404, message: "Actor not found" });
    }

    const actorCredits = [
      ...actor.movie_credits.cast.map((x: any) => ({
        ...x,
        media_type: "movie",
      })),
      ...actor.tv_credits.cast.map((x: any) => ({
        ...x,
        media_type: "tv",
      })),
    ].map((castMember: any) => ({
      ...castMember,
      profile_path: buildTmdbImageUrl(castMember.profile_path),
      poster_path: buildTmdbImageUrl(castMember.poster_path),
      backdrop_path: buildTmdbImageUrl(castMember.backdrop_path),
    }));

    return {
      actor: {
        ...actor,
        profile_path: buildTmdbImageUrl(actor.profile_path),
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
