import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      // Parse request body to get optional query parameter
      const requestBody = await req.json().catch(() => ({}));
      const query = requestBody.query;

      let queryBuilder = ctx.supabase.from("voice_actors").select("*");

      // Apply filtering if query is provided
      if (query && typeof query === "string" && query.trim()) {
        // Use ilike with concatenated firstname and lastname for case-insensitive search
        const searchQuery = query.trim();
        queryBuilder = queryBuilder.or(
          `firstname.ilike.%${searchQuery}%,lastname.ilike.%${searchQuery}%,firstname.ilike.%${searchQuery.split(" ")[0]}%`,
        );
      }

      const { data, error } = await queryBuilder
        .order("lastname", { ascending: true })
        .order("firstname", { ascending: true });

      if (error) {
        throw error;
      }

      return Response.json({ voice_actors: data });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      return Response.json({ error: errorMessage }, { status: 500 });
    }
  }),
};
