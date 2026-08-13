import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { getParams } from "../_shared/index.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      // Parse request body to get optional query parameter
      const requestBody = await getParams(req).catch(() => ({}));
      const query = (requestBody as any).query;

      const limit = parseInt((requestBody as any).limit) || 100;
      const offset = parseInt((requestBody as any).offset) || 0;

      let queryBuilder = ctx.supabase
        .from("voice_actors")
        .select("*", { count: "exact" });

      // Apply filtering if query is provided
      if (query && typeof query === "string" && query.trim()) {
        // Use ilike with concatenated firstname and lastname for case-insensitive search
        const searchQuery = query.trim();
        queryBuilder = queryBuilder.or(
          `firstname.ilike.%${searchQuery}%,lastname.ilike.%${searchQuery}%,firstname.ilike.%${searchQuery.split(" ")[0]}%`,
        );
      }

      const { data, count, error } = await queryBuilder
        .order("lastname", { ascending: true })
        .order("firstname", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return Response.json({ voice_actors: data, total: count });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      return Response.json({ error: errorMessage }, { status: 500 });
    }
  }),
};
