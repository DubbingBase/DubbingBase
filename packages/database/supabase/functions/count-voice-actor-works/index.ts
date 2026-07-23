import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { ids } = await req.json();

      if (!ids || !Array.isArray(ids)) {
        return Response.json(
          { error: "Missing or invalid ids parameter" },
          { status: 400 }
        );
      }

      // Fetch counts for each ID
      const results: Record<number, number> = {};
      
      for (const id of ids) {
        const { count, error } = await ctx.supabase
          .from('work')
          .select('*', { count: 'exact', head: true })
          .eq('voice_actor_id', id);
          
        if (!error && count !== null) {
          results[id] = count;
        } else {
          results[id] = 0;
        }
      }

      return Response.json(results);
    } catch (error) {
      console.error("Error fetching works counts:", error);
      return Response.json(
        { error: "Failed to fetch works counts" },
        { status: 500 }
      );
    }
  }),
};
