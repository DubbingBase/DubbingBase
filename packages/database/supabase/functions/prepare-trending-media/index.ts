import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { sendOneSignalNotification } from "../_shared/onesignal.ts";
import { buildTmdbImageUrl } from "../_shared/tmdb-urls.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: ["user", "secret"] },
    async (_req, ctx) => {
      try {
        const tmdbApiKey = Deno.env.get("TMDB_API_KEY");
        if (!tmdbApiKey) {
          throw new Error("TMDB_API_KEY environment variable is not set");
        }

        // 1. Fetch trending movies and tv shows in parallel
        const [moviesResponse, showsResponse] = await Promise.all([
          fetch(
            "https://api.themoviedb.org/3/trending/movie/day?language=fr-FR",
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tmdbApiKey}`,
                Accept: "application/json",
              },
            },
          ),
          fetch("https://api.themoviedb.org/3/trending/tv/day?language=fr-FR", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tmdbApiKey}`,
              Accept: "application/json",
            },
          }),
        ]);

        if (!moviesResponse.ok) {
          throw new Error(
            `Movies API request failed: ${moviesResponse.status}`,
          );
        }
        if (!showsResponse.ok) {
          throw new Error(
            `TV Shows API request failed: ${showsResponse.status}`,
          );
        }

        const [moviesData, showsData] = await Promise.all([
          moviesResponse.json(),
          showsResponse.json(),
        ]);

        const movies = (moviesData.results || []).map((item: any) => ({
          ...item,
          type: "movie" as const,
        }));

        const shows = (showsData.results || []).map((item: any) => ({
          ...item,
          type: "tv" as const,
        }));

        // Sort by popularity and take the top 10 of each
        const topMovies = movies
          .sort((a: any, b: any) => b.popularity - a.popularity)
          .slice(0, 10);
        const topShows = shows
          .sort((a: any, b: any) => b.popularity - a.popularity)
          .slice(0, 10);
        const itemsToProcess = [...topMovies, ...topShows];

        const contentIds = itemsToProcess.map((item) => item.id);
        const { data: existingProjects, error: projectsError } =
          await ctx.supabaseAdmin
            .from("dubbing_projects")
            .select("content_id, content_type, work!inner(id)")
            .in("content_id", contentIds)
            .not("work.voice_actor_id", "is", null);

        if (projectsError) {
          throw new Error(`Failed to fetch existing projects: ${projectsError.message}`);
        }

        const itemsWithVoiceActors = new Set(
          existingProjects.map((p) => `${p.content_type}-${p.content_id}`),
        );

        let enqueuedCount = 0;
        let alreadyInQueueCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        // 2. Enqueue items
        for (const media of itemsToProcess) {
          if (itemsWithVoiceActors.has(`${media.type}-${media.id}`)) {
            skippedCount++;
            continue;
          }

          const { error } = await ctx.supabaseAdmin.rpc("enqueue_media_fetch", {
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
              console.error(
                `Error enqueueing ${media.type} ${media.id}:`,
                error,
              );
              failedCount++;
            }
          } else {
            enqueuedCount++;
          }
        }

        // 3. Send compact OneSignal notification
        const summaryMessage = `Enqueued ${enqueuedCount} items.\nSkipped ${alreadyInQueueCount} already in queue.\nSkipped ${skippedCount} already have voice actors.\nFailed to enqueue ${failedCount} items.`;
        let imageUrl: string | undefined = undefined;
        if (itemsToProcess.length > 0 && itemsToProcess[0].poster_path) {
          imageUrl = buildTmdbImageUrl(itemsToProcess[0].poster_path) || undefined;
        }

        await sendOneSignalNotification(
          "DubbingBase Trending Media Report",
          summaryMessage,
          imageUrl ? { imageUrl } : undefined
        );

        return Response.json({
          ok: true,
          message: "Trending media successfully enqueued.",
          stats: {
            enqueued: enqueuedCount,
            alreadyInQueue: alreadyInQueueCount,
            alreadyHaveVoiceActors: skippedCount,
            failed: failedCount,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Trending media queuing failed:", errorMessage);

        await sendOneSignalNotification(
          "Trending Media Job FAILED",
          `Critical failure in prepare-trending-media: ${errorMessage}`,
        );

        return Response.json(
          { ok: false, error: errorMessage },
          { status: 500 },
        );
      }
    },
  ),
};
