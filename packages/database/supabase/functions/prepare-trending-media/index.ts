import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { processTrendingMedia } from "../_shared/trending-processor.ts";

export default {
  fetch: withSupabase<Database>({ auth: "secret:*" }, async (_req, _ctx) => {
    const result = await processTrendingMedia({
      mediaType: "movie",
      tmdbApiPath: "https://api.themoviedb.org/3/trending/movie/day",
      prepareFunctionUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/prepare_movie`,
      delayMs: 5000,
      maxItems: 15,
      ntfyTopic: "Armaldio_DubbingBaseTrendingSummary",
      notificationTitle: "DubbingBase Trending Movies Report",
    });

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.message, summary: result.summary },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      message: result.message,
      summary: result.summary,
      successfulCount: result.successfulCount,
      failedCount: result.failedCount,
    });
  }),
};
