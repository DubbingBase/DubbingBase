import { createErrorResponse, createResponse } from "../_shared/http-utils.ts";
import { SupabaseContext, withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

interface HomeStats {
  voiceActorCount: number;
  dubbingProjectCount: number;
  workCount: number;
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const [
        { count: voiceActorCount },
        { count: dubbingProjectCount },
        { count: workCount },
      ] = await Promise.all([
        ctx.supabaseAdmin
          .from("voice_actors")
          .select("*", { count: "exact", head: true }),
        ctx.supabaseAdmin
          .from("dubbing_projects")
          .select("*", { count: "exact", head: true }),
        ctx.supabaseAdmin
          .from("work")
          .select("*", { count: "exact", head: true }),
      ]);

      const data: HomeStats = {
        voiceActorCount: voiceActorCount || 0,
        dubbingProjectCount: dubbingProjectCount || 0,
        workCount: workCount || 0,
      };

      return createResponse(data);
    } catch (error) {
      console.error("Error in home-stats function:", error);
      return createErrorResponse("Internal server error");
    }
  }),
};
