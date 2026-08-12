import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";
import { cacheUtils, getParams } from "../_shared/index.ts";

interface TrendingVoiceActorsParams {
  limit?: number | string;
  months?: number | string;
}

const getTrendingVoiceActors = async (
  ctx: SupabaseContext<Database>,
  limit = 10,
  months = 6,
) => {
  try {
    const { data, error } = await ctx.supabase.rpc(
      "get_trending_voice_actors",
      {
        limit_param: limit,
        months_param: months,
      },
    );

    if (error) throw error;

    const resultsWithImageUrls = data.map((result: any) => ({
      ...result.voice_actor,
      work_count: result.work_count,
      profile_picture: buildSupabaseImageUrl(
        ctx,
        result.voice_actor.profile_picture,
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

const cacheKey = "app:trending:voice-actors:v1";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const params = (await getParams(req)) as TrendingVoiceActorsParams;
      const limit = params.limit ? Number(params.limit) : 10;
      const months = params.months ? Number(params.months) : 6;

      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return Response.json(
          { error: "Limit must be a number between 1 and 100" },
          { status: 400 },
        );
      }

      if (!Number.isInteger(months) || months < 1 || months > 24) {
        return Response.json(
          { error: "Months must be a number between 1 and 24" },
          { status: 400 },
        );
      }

      const dynamicCacheKey = `${cacheKey}:${months}m:${limit}`;

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
        "Cache miss for trending voice actors, fetching from database",
      );
      const results = await getTrendingVoiceActors(ctx, limit, months);

      try {
        await cacheUtils.set(dynamicCacheKey, results, "SHORT");
      } catch (cacheErr) {
        console.error("Failed to write to Redis cache:", cacheErr);
      }

      return Response.json(results);
    } catch (error) {
      console.error("Error in trending-voice-actors function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
