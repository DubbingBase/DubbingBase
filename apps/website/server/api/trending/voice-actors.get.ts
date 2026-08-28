import { useSupabaseAdmin } from "../../utils/db/client";
import { useTmdbClient, useIgdbClient, useCache } from "../../utils";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const query = getQuery(event);
  const limit = Number(query.limit) || 10;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError({
      statusCode: 400,
      message: "Limit must be a number between 1 and 100",
    });
  }

  const cache = useCache();
  const cacheKey = `app:trending:voice-actors:v2:limit:${limit}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const tmdbClient = useTmdbClient();
    const igdbClient = useIgdbClient();

    const [trendingMovies, trendingShows, trendingGames] = await Promise.all([
      tmdbClient.get("trending/movie/week").catch(() => ({ results: [] })),
      tmdbClient.get("trending/tv/week").catch(() => ({ results: [] })),
      igdbClient.getTrendingGames(20).catch(() => []),
    ]);

    const movieIds = trendingMovies.results?.map((m: any) => m.id) || [];
    const showIds = trendingShows.results?.map((s: any) => s.id) || [];
    const gameIds = (Array.isArray(trendingGames) ? trendingGames : []).map(
      (g: any) => g.id,
    );

    const trendingIds = [...movieIds, ...showIds, ...gameIds];

    if (trendingIds.length === 0) {
      return [];
    }

    const supabase = useSupabaseAdmin();
    const { data: works, error } = await supabase
      .from("work")
      .select(
        "id, voice_actor_id, voice_actors(id, firstname, lastname, profile_picture, bio, nationality, date_of_birth, awards, years_active, social_media_links, tmdb_id, wikidata_id), dubbing_projects!inner(content_id)",
      )
      .in("dubbing_projects.content_id", trendingIds)
      .not("voice_actor_id", "is", null);

    if (error) throw error;

    const vaMap = new Map<
      number,
      {
        id: number;
        firstname: string;
        lastname: string;
        profile_picture: string | null;
        bio: string | null;
        nationality: string | null;
        date_of_birth: string | null;
        awards: string | null;
        years_active: string | null;
        social_media_links: any;
        tmdb_id: number | null;
        wikidata_id: string | null;
        work_count: number;
      }
    >();

    for (const work of works || []) {
      const va = work.voice_actors as any;
      if (!va) continue;
      const vaId = va.id;
      if (!vaMap.has(vaId)) {
        vaMap.set(vaId, {
          id: vaId,
          firstname: va.firstname,
          lastname: va.lastname,
          profile_picture: va.profile_picture,
          bio: va.bio,
          nationality: va.nationality,
          date_of_birth: va.date_of_birth,
          awards: va.awards,
          years_active: va.years_active,
          social_media_links: va.social_media_links,
          tmdb_id: va.tmdb_id,
          wikidata_id: va.wikidata_id,
          work_count: 0,
        });
      }
      vaMap.get(vaId)!.work_count++;
    }

    const results = Array.from(vaMap.values())
      .sort((a, b) => b.work_count - a.work_count)
      .slice(0, limit)
      .map((va) => ({
        ...va,
        profile_picture: buildSupabaseImageUrl(
          va.profile_picture,
          "voice_actor_profile_pictures",
          "500",
        ),
      }));

    await cache.set(cacheKey, results, "SHORT");

    return results;
  } catch (error: any) {
    console.error("Error in trending voice actors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
