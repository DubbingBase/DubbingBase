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

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

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
