import {
  useTmdbClient,
  useIgdbClient,
  useOpenLibraryClient,
  usePodcastClient,
  useAdvertisementClient,
  useToyClient,
} from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { normalizeString } from "../../utils/normalize";
import { processMedia } from "../../utils/urls/tmdb";
import { buildSupabaseImageUrl } from "../../utils/urls/supabase";
import { useSupabaseAdmin } from "../../utils/db/client";

type SearchItem = {
  [key: string]: unknown;
  id?: string | number | null;
  title?: string | null;
  name?: string | null;
  voice_actor_name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  popularity?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  first_release_date?: number | null;
  tmdb_id?: number | null;
  profile_picture?: string | null;
  profile_path?: string | null;
  media_type?: string;
  score?: number;
};

function isSearchItem(value: unknown): value is SearchItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const isOptionalString = (key: string) => {
    const property = Reflect.get(value, key);
    return property === undefined || typeof property === "string";
  };
  const isOptionalId = () => {
    const property = Reflect.get(value, "id");
    return (
      property === undefined ||
      property === null ||
      typeof property === "string" ||
      typeof property === "number"
    );
  };
  const isOptionalNullableString = (key: string) => {
    const property = Reflect.get(value, key);
    return property === undefined || property === null || typeof property === "string";
  };
  const isOptionalNullableNumber = (key: string) => {
    const property = Reflect.get(value, key);
    return property === undefined || property === null || typeof property === "number";
  };

  return (
    isOptionalNullableString("title") &&
    isOptionalNullableString("name") &&
    isOptionalNullableString("voice_actor_name") &&
    isOptionalNullableString("firstname") &&
    isOptionalNullableString("lastname") &&
    isOptionalNullableString("release_date") &&
    isOptionalNullableString("first_air_date") &&
    isOptionalString("media_type") &&
    isOptionalId() &&
    isOptionalNullableNumber("popularity") &&
    isOptionalNullableNumber("vote_average") &&
    isOptionalNullableNumber("vote_count") &&
    isOptionalNullableNumber("first_release_date") &&
    isOptionalNullableNumber("tmdb_id") &&
    isOptionalNullableString("profile_picture") &&
    isOptionalNullableString("profile_path")
  );
}

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

function calculateScore(item: SearchItem, queryLower: string, now: number): number {
  let score = 0;

  let itemDisplayName =
    (typeof item.title === "string" && item.title) ||
    (typeof item.name === "string" && item.name) ||
    (typeof item.voice_actor_name === "string" && item.voice_actor_name) ||
    "";
  if (!itemDisplayName && typeof item.firstname === "string" && typeof item.lastname === "string") {
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
  } else if (item.first_release_date && typeof item.first_release_date === "number") {
    releaseMs = item.first_release_date * 1000;
  }

  if (releaseMs && !isNaN(releaseMs)) {
    const ageYears = Math.max(0, (now - releaseMs) / (365.25 * 24 * 3600 * 1000));
    score += Math.max(0, 15 - ageYears * 1.5);
  }

  return score;
}

export default defineEventHandler(async (event) => {
  try {
    const rawQuery = getQuery(event).query;
    const query = typeof rawQuery === "string" ? rawQuery : undefined;

    if (!query) {
      return [];
    }

    const trimmedQuery = normalizeString(query);

    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    const tmdbClient = useTmdbClient();
    const igdbClient = useIgdbClient();
    const openLibraryClient = useOpenLibraryClient();
    const podcastClient = usePodcastClient();
    const adClient = useAdvertisementClient();
    const toyClient = useToyClient();
    const supabase = useSupabaseAdmin();

    // 1. TMDB multi-search
    const tmdbSearchPromise = (async () => {
      const results: SearchItem[] = [];
      try {
        const pageResponses = await Promise.all(
          [1, 2].map((page) => tmdbClient.searchMulti(trimmedQuery, page, "fr-FR")),
        );

        for (const response of pageResponses) {
          if (response.results && Array.isArray(response.results)) {
            const withImages = response.results
              .filter(isSearchItem)
              .map((item) => processMedia(item))
              .filter(isSearchItem);
            results.push(...withImages);
          }
        }
      } catch (e) {
        console.error("TMDB fetch error:", e);
      }
      return results;
    })();

    // 2. Voice actor DB search
    const voiceActorSearchPromise = (async () => {
      const results: SearchItem[] = [];
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
          .or(`firstname.ilike.%${trimmedQuery}%,lastname.ilike.%${trimmedQuery}%`)
          .limit(20);

        if (ilikeData && Array.isArray(ilikeData)) {
          const seenIds = new Set(results.map((va) => va.id));
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
      const results: SearchItem[] = [];
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

    // 4. OpenLibrary audiobook search
    const openLibrarySearchPromise = (async () => {
      try {
        const books = await openLibraryClient.searchBooks(trimmedQuery);
        return books.map((book) => ({
          ...book,
          poster_path: book.cover_url,
          media_type: "audiobook" as const,
        }));
      } catch (e) {
        console.error("OpenLibrary search error:", e);
        return [];
      }
    })();

    // 5. iTunes Podcast search
    const podcastSearchPromise = (async () => {
      try {
        const podcasts = await podcastClient.searchPodcasts(trimmedQuery);
        return podcasts.map((p) => ({
          ...p,
          poster_path: p.cover_url,
          media_type: "podcast" as const,
        }));
      } catch (e) {
        console.error("Podcast search error:", e);
        return [];
      }
    })();

    // 6. Advertisement search
    const adSearchPromise = (async () => {
      try {
        const ads = await adClient.searchAdvertisements(trimmedQuery);
        return ads.map((ad) => ({
          ...ad,
          media_type: "advertisement" as const,
        }));
      } catch (e) {
        console.error("Advertisement search error:", e);
        return [];
      }
    })();

    // 7. Toy search
    const toySearchPromise = (async () => {
      try {
        const toys = await toyClient.searchToys(trimmedQuery);
        return toys.map((toy) => ({
          ...toy,
          media_type: "toy" as const,
        }));
      } catch (e) {
        console.error("Toy search error:", e);
        return [];
      }
    })();

    // Execute all tracks concurrently
    const [
      tmdbResults,
      dbVoiceActorResults,
      igdbResults,
      openLibraryResults,
      podcastResults,
      adResults,
      toyResults,
    ] = await Promise.all([
      tmdbSearchPromise,
      voiceActorSearchPromise,
      igdbSearchPromise,
      openLibrarySearchPromise,
      podcastSearchPromise,
      adSearchPromise,
      toySearchPromise,
    ]);

    let resp: SearchItem[] = [...tmdbResults];

    // Deduplicate IGDB games
    const igdbKeySet = new Set<string>();
    for (const game of igdbResults) {
      const key = `video_game:${game.id}`;
      if (!igdbKeySet.has(key)) {
        igdbKeySet.add(key);
        resp.push(game);
      }
    }

    // Deduplicate OpenLibrary audiobooks
    const bookKeySet = new Set<string>();
    for (const book of openLibraryResults) {
      const key = `audiobook:${book.id}`;
      if (!bookKeySet.has(key)) {
        bookKeySet.add(key);
        resp.push(book);
      }
    }

    // Deduplicate Podcasts
    const podcastKeySet = new Set<string>();
    for (const pod of podcastResults) {
      const key = `podcast:${pod.id}`;
      if (!podcastKeySet.has(key)) {
        podcastKeySet.add(key);
        resp.push(pod);
      }
    }

    // Deduplicate Advertisements
    for (const ad of adResults) {
      resp.push(ad);
    }

    // Deduplicate Toys
    for (const toy of toyResults) {
      resp.push(toy);
    }

    const voiceActorResults = [...dbVoiceActorResults];

    // 5. Merge voice actors with TMDB entities
    if (voiceActorResults.length > 0) {
      const respMap = new Map<string, SearchItem>();
      resp.forEach((item) => {
        if (item && item.id != null) {
          const key = `${item.media_type ?? "unknown"}:${item.id}`;
          respMap.set(key, item);
        }
      });

      voiceActorResults.forEach((voiceActor) => {
        const vaKey = `voice_actor:${voiceActor.id}`;
        if (voiceActor.tmdb_id != null) {
          const tmdbKey = `person:${voiceActor.tmdb_id}`;
          const person = respMap.get(tmdbKey);
          if (person) {
            respMap.delete(tmdbKey);
            respMap.set(vaKey, {
              ...voiceActor,
              actor: person,
              profile_path:
                buildSupabaseImageUrl(voiceActor.profile_picture) ?? person.profile_path,
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

    // Score each result once; sort and return using the same score value.
    const now = Date.now();
    return resp
      .filter((item) => item != null)
      .map((item) => ({
        ...item,
        score: calculateScore(item, trimmedQuery, now),
      }))
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Error in search function:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
