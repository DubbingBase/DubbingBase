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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const words = trimmedQuery.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    // Find the most specific word (longest word) to query the database
    const longestWord = words.reduce((a, b) => a.length > b.length ? a : b, "");

    // Query database with a larger limit to prevent truncation of alphabetical sorting
    const { data, error } = await ctx.supabase
      .from("voice_actors")
      .select("*")
      .or(`firstname.ilike.%${longestWord}%,lastname.ilike.%${longestWord}%`)
      .limit(300); // Generous limit to capture all relevant matches

    if (error) throw error;

    const lowerWords = words.map(w => w.toLowerCase());

    // Filter in JS: must match ALL search words in either first or last name
    const matches = data.filter((actor) => {
      const first = (actor.firstname || "").toLowerCase();
      const last = (actor.lastname || "").toLowerCase();
      const fullName = `${first} ${last}`;

      return lowerWords.every(word => 
        first.includes(word) || last.includes(word) || fullName.includes(word)
      );
    });

    // Score and sort by search relevance
    const scored = matches.map((actor) => {
      const first = (actor.firstname || "").toLowerCase();
      const last = (actor.lastname || "").toLowerCase();
      
      let score = 0;
      const primaryQuery = lowerWords[0];

      // Exact match gets highest priority
      if (first === primaryQuery || last === primaryQuery) {
        score += 100;
      }
      // Prefix matches (starts with) get high priority
      else if (first.startsWith(primaryQuery) || last.startsWith(primaryQuery)) {
        score += 50;
      }
      // Substring match gets normal priority
      else {
        score += 10;
      }

      // Bonus for shorter names (more exact matches)
      score -= (first.length + last.length) * 0.1;

      return { actor, score };
    });

    // Sort descending by score, then alphabetically by lastname
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const lastA = (a.actor.lastname || "").toLowerCase();
      const lastB = (b.actor.lastname || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });

    return scored.slice(0, limit).map(s => s.actor);
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
