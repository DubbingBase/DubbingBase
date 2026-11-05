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
import { readProperty } from "@app/shared-logic";

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
  studio_names?: string[];
  tmdb_id?: number | null;
  profile_picture?: string | null;
  profile_path?: string | null;
  media_type?: string;
  score?: number;
};

function isSearchItem(value: unknown): value is SearchItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const isOptionalString = (key: string) => {
    const property = readProperty(value, key);
    return property === undefined || typeof property === "string";
  };
  const isOptionalId = () => {
    const property = readProperty(value, "id");
    return (
      property === undefined ||
      property === null ||
      typeof property === "string" ||
      typeof property === "number"
    );
  };
  const isOptionalNullableString = (key: string) => {
    const property = readProperty(value, key);
    return property === undefined || property === null || typeof property === "string";
  };
  const isOptionalNullableNumber = (key: string) => {
    const property = readProperty(value, key);
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

function getTmdbLocale(locale: unknown): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "es") return "es-ES";
  if (locale === "ja") return "ja-JP";
  return "en-US";
}

function calculateScore(item: SearchItem, queryLower: string, now: number): number {
  let score = 0;
  let relevanceTier = 0;

  const displayNames = [
    (typeof item.title === "string" && item.title) ||
      (typeof item.name === "string" && item.name) ||
      (typeof item.voice_actor_name === "string" && item.voice_actor_name) ||
      "",
    item.original_title,
    item.original_name,
    typeof item.product_line === "string" ? item.product_line : "",
    typeof item.manufacturer === "string" ? item.manufacturer : "",
    typeof item.brand === "string" ? item.brand : "",
    typeof item.firstname === "string" && typeof item.lastname === "string"
      ? `${item.firstname} ${item.lastname}`
      : "",
  ].filter((name): name is string => typeof name === "string" && name.length > 0);
  const itemNames = displayNames.map(normalizeString);

  if (itemNames.some((name) => name === queryLower)) {
    relevanceTier = 3;
  } else if (itemNames.some((name) => name.startsWith(queryLower))) {
    relevanceTier = 2;
  } else if (itemNames.some((name) => name.includes(queryLower))) {
    relevanceTier = 1;
  }

  const pop = item.popularity || 0;
  score += Math.min(Math.sqrt(pop) * 3, 50);

  score += Math.min((item.vote_average || 0) * 0.1, 1);

  const vc = item.vote_count || 0;
  score += Math.min(Math.log10(vc + 1) * 3, 15);

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

  return relevanceTier * 1000 + score;
}

function projectSearchResult(item: SearchItem): SearchItem {
  const cover = item.cover;
  const coverUrl =
    typeof cover === "object" && cover !== null && !Array.isArray(cover)
      ? readProperty(cover, "url")
      : undefined;

  return {
    id: item.id,
    media_type: item.media_type,
    title: item.title,
    name: item.name,
    voice_actor_name: item.voice_actor_name,
    firstname: item.firstname,
    lastname: item.lastname,
    profile_path: item.profile_path,
    poster_path: item.poster_path,
    popularity: item.popularity,
    score: item.score,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    first_release_date: item.first_release_date,
    original_title: item.original_title,
    original_name: item.original_name,
    studio_names: item.studio_names,
    ...(typeof coverUrl === "string" ? { cover: { url: coverUrl } } : {}),
    author_name: item.author_name,
    brand: item.brand,
    manufacturer: item.manufacturer,
    product_line: item.product_line,
    overview: item.overview,
  };
}

export default defineEventHandler(async (event) => {
  try {
    const rawQuery = getQuery(event).query;
    const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : undefined;

    if (!query) {
      return [];
    }

    const providerQuery = query;
    const trimmedQuery = normalizeString(query);

    if (!trimmedQuery || providerQuery.length < 2) {
      return [];
    }

    const tmdbClient = useTmdbClient();
    const igdbClient = useIgdbClient();
    const openLibraryClient = useOpenLibraryClient();
    const podcastClient = usePodcastClient();
    const adClient = useAdvertisementClient();
    const toyClient = useToyClient();
    const supabase = useSupabaseAdmin();
    let successfulTracks = 0;
    const tmdbLocale = getTmdbLocale(getQuery(event).locale);

    // 1. TMDB multi-search
    const tmdbSearchPromise = (async () => {
      const results: SearchItem[] = [];
      try {
        const pageResponses = await Promise.all(
          [1, 2].map((page) => tmdbClient.searchMulti(providerQuery, page, tmdbLocale)),
        );

        for (const response of pageResponses) {
          if (response.results && Array.isArray(response.results)) {
            for (const item of response.results.filter(isSearchItem)) {
              const processed = processMedia(item);
              if (isSearchItem(processed)) results.push(processed);
            }
          }
        }
        successfulTracks += 1;
      } catch (e) {
        console.error("TMDB fetch error:", e);
      }
      return results;
    })();

    // 2. Voice actor DB search
    const voiceActorSearchPromise = (async () => {
      const results: SearchItem[] = [];
      let trackSucceeded = false;
      const searchQuery = buildTextSearchQuery(trimmedQuery);
      if (searchQuery) {
        try {
          const { data: ftsData, error: ftsError } = await supabase
            .from("voice_actors")
            .select("*")
            .textSearch("voice_actor_name", searchQuery)
            .limit(20);
          if (ftsError) throw ftsError;

          if (ftsData && Array.isArray(ftsData)) {
            results.push(...ftsData);
          }
          trackSucceeded = true;
        } catch (e) {
          console.error("Voice actor full-text search error:", e);
        }
      }

      // Also try ILIKE for partial matches, even when full-text search fails.
      try {
        const { data: ilikeData, error: ilikeError } = await supabase
          .from("voice_actors")
          .select("*")
          .or(`firstname.ilike.%${trimmedQuery}%,lastname.ilike.%${trimmedQuery}%`)
          .limit(20);
        if (ilikeError) throw ilikeError;

        if (ilikeData && Array.isArray(ilikeData)) {
          const seenIds = new Set(results.map((va) => va.id));
          for (const va of ilikeData) {
            if (!seenIds.has(va.id)) {
              results.push(va);
              seenIds.add(va.id);
            }
          }
        }
        trackSucceeded = true;
      } catch (e) {
        console.error("Voice actor partial search error:", e);
      }

      if (trackSucceeded) {
        successfulTracks += 1;
      }
      return results;
    })();

    // 3. IGDB game search
    const igdbSearchPromise = (async () => {
      const results: SearchItem[] = [];
      try {
        const igdbGames = await igdbClient.searchGames(providerQuery);
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
        successfulTracks += 1;
      } catch (e) {
        console.error("IGDB search error:", e);
      }
      return results;
    })();

    // 4. OpenLibrary audiobook search
    const openLibrarySearchPromise = (async () => {
      try {
        const books = await openLibraryClient.searchBooks(providerQuery);
        successfulTracks += 1;
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
        const podcasts = await podcastClient.searchPodcasts(providerQuery);
        successfulTracks += 1;
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
        const ads = await adClient.searchAdvertisements(providerQuery);
        successfulTracks += 1;
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
        const toys = await toyClient.searchToys(providerQuery);
        successfulTracks += 1;
        return toys.map((toy) => ({
          ...toy,
          media_type: "toy" as const,
        }));
      } catch (e) {
        console.error("Toy search error:", e);
        return [];
      }
    })();

    const enrichedTmdbSearchPromise = tmdbSearchPromise.then(async (tmdbResults) => {
      const tmdbIds = [
        ...new Set(
          tmdbResults
            .filter(
              (item) =>
                (item.media_type === "movie" || item.media_type === "tv") &&
                typeof item.id === "number",
            )
            .map((item) => Number(item.id)),
        ),
      ];
      if (tmdbIds.length === 0) return tmdbResults;

      try {
        const studioNamesByMedia = new Map<string, Set<string>>();
        const pageSize = 500;
        for (let from = 0; ; from += pageSize) {
          const { data: projects, error } = await supabase
            .from("dubbing_projects")
            .select("id, content_id, content_type, studios(name)")
            .in("content_id", tmdbIds)
            .in("content_type", ["movie", "tv"])
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;

          for (const project of projects ?? []) {
            const studioName = project.studios?.name;
            if (!studioName) continue;
            const key = `${project.content_type}:${project.content_id}`;
            const names = studioNamesByMedia.get(key) ?? new Set<string>();
            names.add(studioName);
            studioNamesByMedia.set(key, names);
          }

          if (!projects || projects.length < pageSize) break;
        }
        return tmdbResults.map((item) => {
          if (item.media_type !== "movie" && item.media_type !== "tv") return item;
          const names = studioNamesByMedia.get(`${item.media_type}:${item.id}`);
          return names
            ? {
                ...item,
                studio_names: [...names].sort((a, b) => a.localeCompare(b)),
              }
            : item;
        });
      } catch (error) {
        console.error("DubbingBase studio enrichment failed:", error);
        return tmdbResults;
      }
    });

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
      enrichedTmdbSearchPromise,
      voiceActorSearchPromise,
      igdbSearchPromise,
      openLibrarySearchPromise,
      podcastSearchPromise,
      adSearchPromise,
      toySearchPromise,
    ]);

    if (successfulTracks === 0) {
      throw createError({
        statusCode: 503,
        statusMessage: "Search providers unavailable",
      });
    }

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

    const uniqueResults = new Map<string, SearchItem>();
    for (const item of resp) {
      if (item.id == null) continue;
      const key = `${item.media_type ?? "unknown"}:${item.id}`;
      const previous = uniqueResults.get(key);
      const studioNames = new Set([
        ...(previous?.studio_names ?? []),
        ...(item.studio_names ?? []),
      ]);
      uniqueResults.set(key, {
        ...previous,
        ...item,
        ...(studioNames.size > 0
          ? {
              studio_names: [...studioNames].sort((a, b) => a.localeCompare(b)),
            }
          : {}),
      });
    }
    resp = [...uniqueResults.values()];

    // Score each result once; sort and return using the same score value.
    const now = Date.now();
    const results = resp
      .filter((item) => item != null)
      .map((item) => ({
        ...item,
        score: calculateScore(item, trimmedQuery, now),
      }))
      .sort(
        (a, b) =>
          (b.score ?? 0) - (a.score ?? 0) ||
          String(a.media_type ?? "").localeCompare(String(b.media_type ?? "")) ||
          String(a.id ?? "").localeCompare(String(b.id ?? ""), undefined, {
            numeric: true,
          }),
      );
    return getQuery(event).projection === "search-page"
      ? results.map(projectSearchResult)
      : results;
  } catch (error) {
    console.error("Error in search function:", error);
    if (typeof error === "object" && error !== null && "statusCode" in error) {
      throw error;
    }
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
