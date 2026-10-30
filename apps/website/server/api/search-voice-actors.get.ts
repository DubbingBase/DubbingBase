import { normalizeString } from "../utils/normalize";
import { useSupabaseAdmin } from "../utils/db/client";

async function searchVoiceActors(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  query: string,
  limit = 10,
  useAdminSearchProjection = false,
) {
  const trimmedQuery = normalizeString(query);
  if (!trimmedQuery) return [];

  const words = trimmedQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");

  const voiceActorsQuery = supabaseAdmin.from("voice_actors");
  const projectionQuery = useAdminSearchProjection
    ? voiceActorsQuery.select(
        "id, firstname, lastname, bio, nationality, date_of_birth, tmdb_id, wikidata_id, profile_picture",
      )
    : voiceActorsQuery.select("*");
  const { data, error } = await projectionQuery
    .or(`firstname.ilike.%${longestWord}%,lastname.ilike.%${longestWord}%`)
    .limit(300);

  if (error) throw error;

  const lowerWords = words;

  const scored: Array<{ actor: (typeof data)[number]; score: number }> = [];
  const primaryQuery = lowerWords[0] || "";

  for (const actor of data) {
    const first = normalizeString(actor.firstname);
    const last = normalizeString(actor.lastname);

    const matches = lowerWords.every((word) => first.includes(word) || last.includes(word));
    if (!matches) continue;

    let score = 0;

    if (first === primaryQuery || last === primaryQuery) {
      score += 100;
    } else if (first.startsWith(primaryQuery) || last.startsWith(primaryQuery)) {
      score += 50;
    } else {
      score += 10;
    }

    score -= (first.length + last.length) * 0.1;

    scored.push({ actor, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const lastA = (a.actor.lastname || "").toLowerCase();
    const lastB = (b.actor.lastname || "").toLowerCase();
    return lastA.localeCompare(lastB);
  });

  return scored.slice(0, limit).map((item) => item.actor);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchQuery = query.query;
  const limit = query.limit ? Number(query.limit) : 10;

  if (!searchQuery || typeof searchQuery !== "string") {
    throw createError({
      statusCode: 400,
      message: "Query parameter is required",
    });
  }

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  try {
    return await searchVoiceActors(
      supabaseAdmin,
      searchQuery,
      limit,
      query.projection === "admin-search",
    );
  } catch (error) {
    console.error("Error in search-voice-actors route:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
