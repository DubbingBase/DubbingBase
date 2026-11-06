import { useSupabaseAdmin } from "../utils/db/client";
import { buildTmdbImageUrl } from "../utils/urls/tmdb";
import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import { requireAdmin } from "../utils/auth";

interface TrendingItem {
  id: number;
  popularity: number;
  poster_path: string | null;
  type: "movie" | "tv";
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json();
  return payload;
}

function parseTrendingResults(payload: unknown, type: TrendingItem["type"]): TrendingItem[] {
  if (typeof payload !== "object" || payload === null) return [];
  const results: unknown = Reflect.get(payload, "results");
  if (!Array.isArray(results)) return [];

  const items: TrendingItem[] = [];
  for (const item of results) {
    if (typeof item !== "object" || item === null) continue;
    const id: unknown = Reflect.get(item, "id");
    if (typeof id !== "number" || Reflect.get(item, "adult") === true) continue;

    const popularity: unknown = Reflect.get(item, "popularity");
    const posterPath: unknown = Reflect.get(item, "poster_path");
    items.push({
      id,
      popularity: typeof popularity === "number" ? popularity : 0,
      poster_path: typeof posterPath === "string" ? posterPath : null,
      type,
    });
  }
  return items;
}

export default defineEventHandler(async (event) => {
  const internalSecret = getHeader(event, "x-internal-secret");
  const authHeader = getHeader(event, "authorization");
  const apiKeyHeader = getHeader(event, "apikey");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const config = useRuntimeConfig(event);
  const secretKey =
    (typeof config.supabaseSecretKey === "string" ? config.supabaseSecretKey : "") ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NUXT_SUPABASE_SECRET_KEY ||
    "";
  const isInternalTrigger =
    Boolean(secretKey) &&
    ((Boolean(internalSecret) && internalSecret === secretKey) ||
      (Boolean(bearerToken) && bearerToken === secretKey) ||
      (Boolean(apiKeyHeader) && apiKeyHeader === secretKey));

  if (!isInternalTrigger) {
    await requireAdmin(event);
  }

  try {
    const tmdbApiKey = config.tmdbApiKey;
    if (!tmdbApiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const [moviesResponse, showsResponse] = await Promise.all([
      fetch("https://api.themoviedb.org/3/trending/movie/day", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tmdbApiKey}`,
          Accept: "application/json",
        },
      }),
      fetch("https://api.themoviedb.org/3/trending/tv/day", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tmdbApiKey}`,
          Accept: "application/json",
        },
      }),
    ]);

    if (!moviesResponse.ok) {
      throw new Error(`Movies API request failed: ${moviesResponse.status}`);
    }
    if (!showsResponse.ok) {
      throw new Error(`TV Shows API request failed: ${showsResponse.status}`);
    }

    const [moviesData, showsData]: [unknown, unknown] = await Promise.all([
      readJsonPayload(moviesResponse),
      readJsonPayload(showsResponse),
    ]);

    const topMovies = parseTrendingResults(moviesData, "movie")
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
    const topShows = parseTrendingResults(showsData, "tv")
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
    const itemsToProcess = [...topMovies, ...topShows];

    const supabaseAdmin = useSupabaseAdmin(event);

    const contentIds = itemsToProcess.map((item) => item.id);
    const { data: existingProjects, error: projectsError } = await supabaseAdmin
      .from("dubbing_projects")
      .select("content_id, content_type")
      .in("content_id", contentIds);

    if (projectsError) {
      throw new Error(`Failed to fetch existing projects: ${projectsError.message}`);
    }

    const itemsWithVoiceActors = new Set(
      (existingProjects || []).map((p) => `${p.content_type}-${p.content_id}`),
    );

    let enqueuedCount = 0;
    let alreadyInQueueCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const media of itemsToProcess) {
      if (itemsWithVoiceActors.has(`${media.type}-${media.id}`)) {
        skippedCount++;
        continue;
      }

      const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
        p_tmdb_id: media.id,
        p_media_type: media.type,
      });

      if (error) {
        if (error.message && error.message.includes("already in the")) {
          alreadyInQueueCount++;
        } else {
          console.error(`Error enqueueing ${media.type} ${media.id}:`, error);
          failedCount++;
        }
      } else {
        enqueuedCount++;
      }
    }

    const summaryMessage = `Enqueued **${enqueuedCount}** items.\nSkipped **${alreadyInQueueCount}** already in queue.\nSkipped **${skippedCount}** already have voice actors.\nFailed to enqueue **${failedCount}** items.`;
    let imageUrl: string | undefined = undefined;
    const firstPoster = itemsToProcess[0]?.poster_path;
    if (firstPoster) {
      imageUrl = buildTmdbImageUrl(firstPoster) || undefined;
    }

    await sendDiscordAdminNotification("DubbingBase Trending Media Report", summaryMessage, {
      event,
      queue: "wiki_discovery",
      ...(imageUrl ? { imageUrl } : {}),
    });

    return {
      ok: true,
      message: "Trending media successfully enqueued.",
      stats: {
        enqueued: enqueuedCount,
        alreadyInQueue: alreadyInQueueCount,
        alreadyHaveVoiceActors: skippedCount,
        failed: failedCount,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Trending media queuing failed:", errorMessage);

    await sendDiscordAdminNotification(
      "Trending Media Job FAILED",
      `Critical failure in prepare-trending-media: ${errorMessage}`,
      { event },
    );

    throw createError({ statusCode: 500, message: errorMessage });
  }
});
