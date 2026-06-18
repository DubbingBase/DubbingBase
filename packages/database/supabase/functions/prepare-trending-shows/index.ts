import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { processTrendingMedia } from "../_shared/trending-processor.ts";

export default {
  fetch: withSupabase<Database>({ auth: "secret:*" }, async (_req, _ctx) => {
    const result = await processTrendingMedia({
      mediaType: "tv",
      tmdbApiPath: "https://api.themoviedb.org/3/trending/tv/day",
      prepareFunctionUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/show`,
      delayMs: 5000,
      maxItems: 15,
      ntfyTopic: "Armaldio_DubbingBaseTrendingSummary",
      notificationTitle: "DubbingBase Trending Shows Report",
    });

    if (!result.ok) {
      console.error("Trending shows processing failed:", result.message);
      return Response.json(
        { ok: false, error: result.message, summary: result.summary },
        { status: 500 },
      );
    }

    console.log(
      "Trending shows processing completed successfully:",
      result.message,
    );
    return Response.json({
      ok: true,
      message: result.message,
      summary: result.summary,
      successfulCount: result.successfulCount,
      failedCount: result.failedCount,
    });
  }),
};
