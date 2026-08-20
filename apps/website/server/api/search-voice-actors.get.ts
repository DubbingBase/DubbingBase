import { normalizeString } from "../utils/normalize";
import { useSupabaseAdmin } from "../utils/db/client";

interface SearchParams {
  query: string;
  limit?: number;
}

async function searchVoiceActors(
  supabaseAdmin: any,
  query: string,
  limit = 10,
) {
  const trimmedQuery = normalizeString(query);
  if (!trimmedQuery) return [];

  const words = trimmedQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");

  const { data, error } = await supabaseAdmin
    .from("voice_actors")
    .select("*")
    .or(`firstname.ilike.%${longestWord}%,lastname.ilike.%${longestWord}%`)
    .limit(300);

  if (error) throw error;

  const lowerWords = words;

  const matches = data.filter((actor: any) => {
    const first = normalizeString(actor.firstname);
    const last = normalizeString(actor.lastname);
    const fullName = `${first} ${last}`;

    return lowerWords.every(
      (word) =>
        first.includes(word) || last.includes(word) || fullName.includes(word),
    );
  });

  const scored = matches.map((actor: any) => {
    const first = normalizeString(actor.firstname);
    const last = normalizeString(actor.lastname);

    let score = 0;
    const primaryQuery = lowerWords[0] || "";

    if (first === primaryQuery || last === primaryQuery) {
      score += 100;
    } else if (
      first.startsWith(primaryQuery) ||
      last.startsWith(primaryQuery)
    ) {
      score += 50;
    } else {
      score += 10;
    }

    score -= (first.length + last.length) * 0.1;

    return { actor, score };
  });

  scored.sort((a: any, b: any) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const lastA = (a.actor.lastname || "").toLowerCase();
    const lastB = (b.actor.lastname || "").toLowerCase();
    return lastA.localeCompare(lastB);
  });

  return scored.slice(0, limit).map((s: any) => s.actor);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchQuery = query.query as string | undefined;
  const limit = query.limit ? Number(query.limit) : 10;

  if (!searchQuery || typeof searchQuery !== "string") {
    throw createError({
      statusCode: 400,
      message: "Query parameter is required",
    });
  }

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  try {
    return await searchVoiceActors(supabaseAdmin, searchQuery, limit);
  } catch (error) {
    console.error("Error in search-voice-actors route:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
