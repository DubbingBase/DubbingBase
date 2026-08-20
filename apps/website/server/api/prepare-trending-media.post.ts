import { useSupabaseAdmin } from "../utils/db/client";
import { findOrCreateDubbingProject } from "../utils/db/dubbing-project";
import { buildTmdbImageUrl } from "../utils/urls/tmdb";
import { sendDiscordAdminNotification } from "../utils/notifications/discord";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const config = useRuntimeConfig();
    const tmdbApiKey = config.tmdbApiKey;
    if (!tmdbApiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const [moviesResponse, showsResponse] = await Promise.all([
      fetch("https://api.themoviedb.org/3/trending/movie/day?language=fr-FR", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tmdbApiKey}`,
          Accept: "application/json",
        },
      }),
      fetch("https://api.themoviedb.org/3/trending/tv/day?language=fr-FR", {
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

    const [moviesData, showsData] = await Promise.all([
      moviesResponse.json(),
      showsResponse.json(),
    ]);

    const movies = (moviesData.results || [])
      .filter((item: any) => item.adult !== true)
      .map((item: any) => ({
        ...item,
        type: "movie" as const,
      }));

    const shows = (showsData.results || [])
      .filter((item: any) => item.adult !== true)
      .map((item: any) => ({
        ...item,
        type: "tv" as const,
      }));

    const topMovies = movies
      .sort((a: any, b: any) => b.popularity - a.popularity)
      .slice(0, 10);
    const topShows = shows
      .sort((a: any, b: any) => b.popularity - a.popularity)
      .slice(0, 10);
    const itemsToProcess = [...topMovies, ...topShows];

    const supabaseAdmin = event.context.supabaseAdmin;
    if (!supabaseAdmin) {
      throw createError({
        statusCode: 500,
        message: "Server configuration error",
      });
    }

    const contentIds = itemsToProcess.map((item) => item.id);
    const { data: existingProjects, error: projectsError } = await supabaseAdmin
      .from("dubbing_projects")
      .select("content_id, content_type")
      .in("content_id", contentIds);

    if (projectsError) {
      throw new Error(
        `Failed to fetch existing projects: ${projectsError.message}`,
      );
    }

    const itemsWithVoiceActors = new Set(
      (existingProjects || []).map(
        (p: any) => `${p.content_type}-${p.content_id}`,
      ),
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
        if (
          error.message &&
          error.message.includes("Request is already in the queue")
        ) {
          alreadyInQueueCount++;
        } else {
          console.error(`Error enqueueing ${media.type} ${media.id}:`, error);
          failedCount++;
        }
      } else {
        enqueuedCount++;
      }
    }

    const summaryMessage = `Enqueued ${enqueuedCount} items.\nSkipped ${alreadyInQueueCount} already in queue.\nSkipped ${skippedCount} already have voice actors.\nFailed to enqueue ${failedCount} items.`;
    let imageUrl: string | undefined = undefined;
    if (itemsToProcess.length > 0 && itemsToProcess[0].poster_path) {
      imageUrl = buildTmdbImageUrl(itemsToProcess[0].poster_path) || undefined;
    }

    await sendDiscordAdminNotification(
      "DubbingBase Trending Media Report",
      summaryMessage,
      imageUrl ? { imageUrl } : undefined,
    );

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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Trending media queuing failed:", errorMessage);

    await sendDiscordAdminNotification(
      "Trending Media Job FAILED",
      `Critical failure in prepare-trending-media: ${errorMessage}`,
    );

    throw createError({ statusCode: 500, message: errorMessage });
  }
});
