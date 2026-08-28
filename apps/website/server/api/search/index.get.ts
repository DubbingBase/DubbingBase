import { useCache, useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { normalizeString } from "../../utils/normalize";
import { processMedia } from "../../utils/urls/tmdb";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import { useSupabaseAdmin } from "../../utils/db/client";

function sanitizeForTextSearch(query: string): string {
  return query.replace(/[&|!():*<>@\\'"]/g, " ").trim();
}

function buildTextSearchQuery(query: string): string {
  const sanitized = sanitizeForTextSearch(query);
  const words = sanitized
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => `'${w}'`);
  if (words.length === 0) return "";
  return words.join(" | ");
}

function calculateScore(item: any, trimmedQuery: string): number {
  let score = 0;

  const queryLower = normalizeString(trimmedQuery);

  let itemDisplayName = item.title || item.name || item.voice_actor_name || "";
  if (!itemDisplayName && item.firstname && item.lastname) {
    itemDisplayName = `${item.firstname} ${item.lastname}`;
  }
  const itemName = normalizeString(itemDisplayName);

  if (itemName === queryLower) {
    score += 30;
  } else if (itemName.includes(queryLower)) {
    if (itemName.startsWith(queryLower)) {
      score += 10;
    } else {
      score += 5;
    }
  }

  const pop = item.popularity || 0;
  score += Math.sqrt(pop) * 3;

  score += (item.vote_average || 0) * 0.1;

  const vc = item.vote_count || 0;
  score += Math.log10(vc + 1) * 3;

  let releaseMs: number | null = null;
  const isoDate = item.release_date || item.first_air_date;
  if (isoDate) {
    releaseMs = new Date(isoDate).getTime();
  } else if (
    item.first_release_date &&
    typeof item.first_release_date === "number"
  ) {
    releaseMs = item.first_release_date * 1000;
  }
  if (releaseMs !== null) {
    const yearsSinceRelease =
      (Date.now() - releaseMs) / (1000 * 60 * 60 * 24 * 365);
    score += Math.max(-5, 5 - yearsSinceRelease * 0.2);
  }

  if (item.media_type === "voice_actor") {
    score += 15;
  }

  if (item.media_type === "video_game") {
    score += 5;
  }

  return score;
}

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
  );

  try {
    const query = getQuery(event).query as string | undefined;

    if (!query) {
      return [];
    }

    const trimmedQuery = normalizeString(query);

    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    const config = useRuntimeConfig();
    const igdbClient = useIgdbClient();
    const supabase = useSupabaseAdmin();

    // 1. TMDB multi-search
    const tmdbSearchPromise = (async () => {
      const results: any[] = [];
      try {
        const pageResponses = await Promise.all(
          [1, 2].map((page) =>
            fetch(
              `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(trimmedQuery)}&page=${page}&language=fr-FR`,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${config.tmdbApiKey}`,
                  Accept: "application/json",
                },
              },
            ),
          ),
        );

        for (const response of pageResponses) {
          if (!response.ok) {
            console.error(
              `TMDB fetch failed with status: ${response.status} ${response.statusText}`,
            );
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
      } catch (e) {
        console.error("TMDB fetch error:", e);
      }
      return results;
    })();

    // 2. Voice actor DB search
    const voiceActorSearchPromise = (async () => {
      const results: any[] = [];
      try {
        const searchQuery = buildTextSearchQuery(trimmedQuery);
        if (searchQuery) {
          const { data: ftsData } = await supabase
            .from("voice_actors")
            .select("*")
            .textSearch("voice_actor_name", searchQuery)
            .limit(20);

          if (ftsData && Array.isArray(ftsData)) {
            results.push(...ftsData);
          }
        }

        // Also try ILIKE for partial matches
        const { data: ilikeData } = await supabase
          .from("voice_actors")
          .select("*")
          .or(
            `firstname.ilike.%${trimmedQuery}%,lastname.ilike.%${trimmedQuery}%`,
          )
          .limit(20);

        if (ilikeData && Array.isArray(ilikeData)) {
          const seenIds = new Set(results.map((va: any) => va.id));
          for (const va of ilikeData) {
            if (!seenIds.has(va.id)) {
              results.push(va);
              seenIds.add(va.id);
            }
          }
        }
      } catch (e) {
        console.error("Voice actor search error:", e);
      }
      return results;
    })();

    // 3. IGDB game search
    const igdbSearchPromise = (async () => {
      const results: any[] = [];
      try {
        const igdbGames = await igdbClient.searchGames(trimmedQuery);
        for (const game of igdbGames) {
          results.push({
            ...game,
            media_type: "video_game",
            cover: game.cover
              ? {
                  ...game.cover,
                  url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
                }
              : undefined,
            popularity: Math.sqrt((game.rating_count ?? 0) + 1) * 10,
            vote_average: (game.rating ?? 0) / 10,
            vote_count: game.rating_count ?? 0,
          });
        }
      } catch (e) {
        console.error("IGDB search error:", e);
      }
      return results;
    })();

    // 4. Execute all three tracks concurrently
    const [tmdbResults, dbVoiceActorResults, igdbResults] = await Promise.all([
      tmdbSearchPromise,
      voiceActorSearchPromise,
      igdbSearchPromise,
    ]);

    let resp: any[] = [...tmdbResults];

    // Deduplicate IGDB games
    const igdbKeySet = new Set<string>();
    for (const game of igdbResults) {
      const key = `video_game:${game.id}`;
      if (!igdbKeySet.has(key)) {
        igdbKeySet.add(key);
        resp.push(game);
      }
    }

    const voiceActorResults = [...dbVoiceActorResults];

    // 5. Merge voice actors with TMDB entities
    if (voiceActorResults.length > 0) {
      const respMap = new Map<string, any>();
      resp.forEach((item) => {
        if (item && item.id != null) {
          const key = `${item.media_type ?? "unknown"}:${item.id}`;
          respMap.set(key, item);
        }
      });

      voiceActorResults.forEach((voiceActor: any) => {
        const vaKey = `voice_actor:${voiceActor.id}`;
        if (voiceActor.tmdb_id != null) {
          const tmdbKey = `person:${voiceActor.tmdb_id}`;
          if (respMap.has(tmdbKey)) {
            const person = respMap.get(tmdbKey);
            respMap.delete(tmdbKey);
            respMap.set(vaKey, {
              ...voiceActor,
              actor: person,
              profile_path:
                buildSupabaseImageUrl(voiceActor.profile_picture) ??
                person.profile_path,
              popularity: person.popularity ?? 50,
              media_type: "voice_actor",
            });
          } else {
            respMap.set(vaKey, {
              ...voiceActor,
              profile_path: buildSupabaseImageUrl(voiceActor.profile_picture),
              media_type: "voice_actor",
              popularity: 50,
              known_for_department: "Dubbing",
            });
          }
        } else {
          respMap.set(vaKey, {
            ...voiceActor,
            profile_path: buildSupabaseImageUrl(voiceActor.profile_picture),
            media_type: "voice_actor",
            popularity: 30,
            known_for_department: "Dubbing",
          });
        }
      });

      resp = Array.from(respMap.values());
    }

    // Sort by composite score
    resp = resp
      .filter((item) => item != null)
      .sort(
        (a, b) =>
          calculateScore(b, trimmedQuery) - calculateScore(a, trimmedQuery),
      );

    // Attach score for debugging/transparency
    resp = resp.map((item) => ({
      ...item,
      score: calculateScore(item, trimmedQuery),
    }));

    return resp;
  } catch (error) {
    console.error("Error in search function:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
