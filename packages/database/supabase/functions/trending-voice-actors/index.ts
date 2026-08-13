import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";
import { cacheUtils, getParams } from "../_shared/index.ts";

interface TrendingVoiceActorsParams {
  limit?: number | string;
}

const getTrendingVoiceActors = async (
  ctx: SupabaseContext<Database>,
  limit = 10,
) => {
  try {
    // 1. Fetch trending media IDs from other Edge Functions
    const [moviesRes, showsRes, gamesRes] = await Promise.all([
      ctx.supabase.functions.invoke("trending-movies"),
      ctx.supabase.functions.invoke("trending-shows"),
      ctx.supabase.functions.invoke("trending-games"),
    ]);

    const movieIds = moviesRes.data?.results?.map((m: any) => m.id) || [];
    const showIds = showsRes.data?.results?.map((s: any) => s.id) || [];
    const gameIds = gamesRes.data?.map((g: any) => g.id) || [];

    const trendingIds = [...movieIds, ...showIds, ...gameIds];

    if (trendingIds.length === 0) {
      return [];
    }

    // 2. Query work table for these trending IDs, joining dubbing_projects
    const { data: works, error } = await ctx.supabase
      .from("work")
      .select(
        `
        id,
        dubbing_projects!inner (
          content_id
        ),
        voice_actors (
          id,
          firstname,
          lastname,
          profile_picture,
          bio,
          nationality,
          date_of_birth,
          awards,
          years_active,
          social_media_links,
          tmdb_id,
          wikidata_id
        )
      `,
      )
      .in("dubbing_projects.content_id", trendingIds)
      .not("voice_actor_id", "is", null);

    if (error) throw error;

    // 3. Group by voice actor and count
    const vaMap = new Map();
    works?.forEach((work: any) => {
      const va = work.voice_actors;
      if (!va) return;

      // Handle Supabase returning an array or object
      const vaObj = Array.isArray(va) ? va[0] : va;

      if (!vaMap.has(vaObj.id)) {
        vaMap.set(vaObj.id, {
          ...vaObj,
          work_count: 0,
        });
      }
      vaMap.get(vaObj.id).work_count++;
    });

    // 4. Sort and limit
    const sortedVas = Array.from(vaMap.values())
      .sort((a, b) => b.work_count - a.work_count)
      .slice(0, limit);

    const resultsWithImageUrls = sortedVas.map((va) => ({
      ...va,
      profile_picture: buildSupabaseImageUrl(
        ctx,
        va.profile_picture,
        "voice_actor_profile_pictures",
        "500",
      ),
    }));

    return resultsWithImageUrls || [];
  } catch (error) {
    console.error("Error fetching trending voice actors:", error);
    throw error;
  }
};

const cacheKey = "app:trending:voice-actors:v2";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const params = (await getParams(req)) as TrendingVoiceActorsParams;
      const limit = params.limit ? Number(params.limit) : 10;

      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return Response.json(
          { error: "Limit must be a number between 1 and 100" },
          { status: 400 },
        );
      }

      const dynamicCacheKey = `${cacheKey}:limit:${limit}`;

      try {
        const cachedData = await cacheUtils.get(dynamicCacheKey);
        if (cachedData) {
          console.log("Cache hit for trending voice actors");
          return Response.json(cachedData);
        }
      } catch (cacheErr) {
        console.error("Redis cache error:", cacheErr);
      }

      console.log(
        "Cache miss for trending voice actors, computing from trending media",
      );
      const results = await getTrendingVoiceActors(ctx, limit);

      try {
        await cacheUtils.set(dynamicCacheKey, results, "SHORT");
      } catch (cacheErr) {
        console.error("Failed to write to Redis cache:", cacheErr);
      }

      return Response.json(results);
    } catch (error: any) {
      console.error("Error in trending-voice-actors function:", error);
      return Response.json(
        {
          error: "Internal server error",
          details: error.message,
          stack: error.stack,
        },
        { status: 500 },
      );
    }
  }),
};
