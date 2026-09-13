import { usePodcastClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import type { PodcastResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<PodcastResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const podcastId = parseInt(id, 10);
  if (isNaN(podcastId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  setPublicCacheHeaders(event, "detail");

  const podcastClient = usePodcastClient();
  const [apiData, dbData] = await Promise.all([
    (async () => {
      try {
        const podcast = await podcastClient.getPodcast(podcastId);
        return {
          failed: false,
          podcast,
        };
      } catch (err) {
        console.error(`Failed to fetch podcast ${podcastId}:`, err);
        return {
          failed: true,
          podcast: {
            id: podcastId,
            title: `Fiction Audio #${podcastId}`,
            media_type: "podcast" as const,
          },
        };
      }
    })(),

    // DB: dubbing projects
    getDubbingProjects(podcastId, "podcast"),
  ]);

  const { podcast } = apiData;
  const dubbingProjects = dbData;

  const isProcessed = dubbingProjects.length > 0;
  // Gated by PostHog 'enqueue-on-navigate' (server-side)
  if (!isProcessed) {
    scheduleBackgroundTask(
      event,
      async () => {
        if (!(await isEnqueueOnNavigateEnabled())) return;
        const supabaseAdmin = useSupabaseAdmin(event);
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "podcast",
          p_tmdb_id: podcastId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error && !error.message?.includes("already in the")) {
          console.error("Failed to lazily enqueue podcast:", error);
        } else if (!error) {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued audio fiction / podcast **${podcast?.title || podcastId}** (Podcast ID: ${podcastId}) for dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(podcast?.cover_url ? { imageUrl: podcast.cover_url } : {}),
              url: `/podcast/${podcastId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "podcast discovery",
    );
  }

  const baseData = {
    podcast,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
