import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { processMedia } from "../_shared/tmdb-urls.ts";

/**
 * Sanitize a user query for use in PostgreSQL full-text search.
 * Escapes special tsquery characters to prevent syntax errors.
 */
function sanitizeForTextSearch(query: string): string {
  // Remove characters that have special meaning in tsquery
  return query.replace(/[&|!():*<>@\\'"]/g, " ").trim();
}

/**
 * Build a tsquery-compatible OR query from individual words.
 */
function buildTextSearchQuery(query: string): string {
  const sanitized = sanitizeForTextSearch(query);
  const words = sanitized
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => `'${w}'`);
  if (words.length === 0) return "";
  return words.join(" | ");
}

// Scoring function combining popularity, vote_average, vote_count, and recency
function calculateScore(item: any, trimmedQuery: string): number {
  let score = 0;

  // Exact match bonus
  const queryLower = trimmedQuery.toLowerCase();
  
  // Construct full name properly, especially for Voice Actors from DB
  let itemDisplayName = item.title || item.name || item.voice_actor_name || "";
  if (!itemDisplayName && item.firstname && item.lastname) {
    itemDisplayName = `${item.firstname} ${item.lastname}`;
  }
  const itemName = itemDisplayName.toLowerCase();

  if (itemName === queryLower) {
    score += 50; // Huge boost for exact match
  } else if (itemName.includes(queryLower)) {
    // If it's a partial match that starts with the query, give more points
    if (itemName.startsWith(queryLower)) {
      score += 20;
    } else {
      score += 10;
    }
  }

  // Popularity weight: TMDB popularity is very important to the user.
  // We use a square root curve instead of log10 so that differences in high popularity 
  // still matter, but don't completely dwarf exact matches.
  // A popularity of 100 -> ~20 points. Popularity of 400 -> ~40 points.
  const pop = item.popularity || 0;
  score += Math.sqrt(pop) * 2; 

  // Vote average weight: max 1.0 (normalized 0-10 scale)
  score += (item.vote_average || 0) * 0.1;

  // Vote count weight: log scale
  const vc = item.vote_count || 0;
  score += Math.log10(vc + 1);

  // Recency weight: favor newer items but don't heavily penalize classics
  const date = item.release_date || item.first_air_date;
  if (date) {
    const yearsSinceRelease = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 365);
    // Decay based on years, capped so old movies don't go too negative
    score += Math.max(-5, 5 - yearsSinceRelease * 0.2);
  }

  // Boost voice actors slightly so they don't get buried under movies
  if (item.media_type === "voice_actor") {
    score += 15; // Higher boost to ensure they appear if there's a name match
  }

  return score;
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { query } = await req.json();

      console.log("query", query);

      const trimmedQuery = query.trim();

      if (!trimmedQuery || trimmedQuery.length < 2) {
        return Response.json([]);
      }

      let resp: any[] = [];

      // Fetch first 2 TMDB pages in parallel (40 results, enough for relevance)
      try {
        const pageResponses = await Promise.all(
          [1, 2].map((page) =>
            fetch(
              `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(trimmedQuery)}&page=${page}&language=fr-FR`,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
                  Accept: "application/json",
                },
              },
            ),
          ),
        );

        const results: any[] = [];
        for (const response of pageResponses) {
          if (!response.ok) {
            console.error(`TMDB fetch failed with status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response body:", text.substring(0, 200));
            continue;
          }
          try {
            const res = await response.json();
            if (res.results && Array.isArray(res.results)) {
              const withImages = res.results
                .filter((x: any) => x !== null)
                .map((x: any) => processMedia(x));
              results.push(...withImages);
            }
          } catch (err) {
            console.error("Error parsing TMDB response:", err);
          }
        }
        resp.push(...results);
      } catch (e) {
        console.error("TMDB fetch error:", e);
      }

      // Voice actor search — use unaccent-aware ilike for robustness
      try {
        const searchQuery = buildTextSearchQuery(trimmedQuery);
        console.log("supabaseQuery", searchQuery);

        let voiceActorResults: any[] = [];

        if (searchQuery) {
          // Primary: full-text search on computed voice_actor_name column
          const { data: ftsData, error: ftsError } = await ctx.supabase
            .from("voice_actors")
            .select()
            .textSearch("voice_actor_name", searchQuery);

          if (!ftsError && ftsData && Array.isArray(ftsData)) {
            voiceActorResults = ftsData;
          }
        }

        // Fallback / supplement: accent-insensitive ilike search on individual fields
        const { data: ilikeData, error: ilikeError } = await ctx.supabase
          .from("voice_actors")
          .select()
          .or(
            `firstname.ilike.%${trimmedQuery}%,lastname.ilike.%${trimmedQuery}%`,
          )
          .limit(20);

        if (!ilikeError && ilikeData && Array.isArray(ilikeData)) {
          // Merge ilike results into voiceActorResults, avoiding duplicates
          const seenIds = new Set(voiceActorResults.map((va) => va.id));
          for (const va of ilikeData) {
            if (!seenIds.has(va.id)) {
              voiceActorResults.push(va);
              seenIds.add(va.id);
            }
          }
        }

        console.log("voice actor results count:", voiceActorResults.length);

        if (voiceActorResults.length > 0) {
          // Build a map keyed by media_type:id to avoid cross-type collisions
          const respMap = new Map<string, any>();
          resp.forEach((item) => {
            if (item && item.id != null) {
              const key = `${item.media_type ?? "unknown"}:${item.id}`;
              respMap.set(key, item);
            }
          });

          // Process voice_actors — merge with TMDB person if tmdb_id matches
          voiceActorResults.forEach((voiceActor) => {
            const vaKey = `voice_actor:${voiceActor.id}`;
            if (voiceActor.tmdb_id != null) {
              // Look for a matching TMDB person entry by tmdb_id
              const tmdbKey = `person:${voiceActor.tmdb_id}`;
              if (respMap.has(tmdbKey)) {
                const person = respMap.get(tmdbKey);
                // Replace the raw TMDB person with the enriched voice actor
                respMap.delete(tmdbKey);
                respMap.set(vaKey, {
                  ...voiceActor,
                  actor: person,
                  profile_path:
                    voiceActor.profile_picture ?? person.profile_path,
                  popularity: person.popularity ?? 50,
                  media_type: "voice_actor",
                });
              } else {
                // Voice actor with tmdb_id but no TMDB result — use moderate base score
                respMap.set(vaKey, {
                  ...voiceActor,
                  profile_path: voiceActor.profile_picture,
                  media_type: "voice_actor",
                  popularity: 50,
                  known_for_department: "Dubbing",
                });
              }
            } else {
              // Voice actor with no tmdb_id — use a low base popularity so they
              // rank naturally alongside other content by relevance
              respMap.set(vaKey, {
                ...voiceActor,
                profile_path: voiceActor.profile_picture,
                media_type: "voice_actor",
                popularity: 30,
                known_for_department: "Dubbing",
              });
            }
          });

          resp = Array.from(respMap.values());
        }
      } catch (e) {
        console.error("Voice actor search error:", e);
      }

      // Sort by composite score
      resp = resp
        .filter((item) => item != null)
        .sort((a, b) => calculateScore(b, trimmedQuery) - calculateScore(a, trimmedQuery));

      // Add score to each item for debugging/transparency
      resp = resp.map((item) => ({ ...item, score: calculateScore(item, trimmedQuery) }));

      return Response.json(resp);
    } catch (error) {
      console.error("Error in search function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
