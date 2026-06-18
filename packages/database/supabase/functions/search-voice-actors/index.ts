import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";

interface SearchParams {
  query: string;
  limit?: number;
}

const searchVoiceActors = async (
  ctx: SupabaseContext<Database>,
  query: string,
  limit = 10,
) => {
  try {
    const { data, error } = await ctx.supabase
      .from("voice_actors")
      .select("*")
      .or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`)
      .order("lastname", { ascending: true })
      .limit(limit * 2); // fetch more to allow for full name filtering

    if (error) throw error;

    // Filter by full name in JS
    const lowerQuery = query.toLowerCase();
    const filtered = data.filter((actor) => {
      const fullName =
        `${actor.firstname || ""} ${actor.lastname || ""}`.toLowerCase();
      return (
        (actor.firstname || "").toLowerCase().includes(lowerQuery) ||
        (actor.lastname || "").toLowerCase().includes(lowerQuery) ||
        fullName.includes(lowerQuery)
      );
    });

    // Return up to 'limit' results
    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Error searching voice actors:", error);
    throw error;
  }
};

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { query, limit = 10 } = (await req
        .json()
        .catch(() => ({}))) as SearchParams;

      if (!query || typeof query !== "string") {
        return Response.json(
          { error: "Query parameter is required" },
          { status: 400 },
        );
      }

      const results = await searchVoiceActors(ctx, query, limit);

      return Response.json(results);
    } catch (error) {
      console.error("Error in search-voice-actors function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
