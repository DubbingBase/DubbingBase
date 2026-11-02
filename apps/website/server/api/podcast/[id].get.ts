import { usePodcastClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import type { PodcastResponse } from "@app/shared-logic";
import { withMediaServiceTimeout } from "../../utils/media-request";

export default defineEventHandler(async (event): Promise<PodcastResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const podcastId = Number(id);
  if (!Number.isSafeInteger(podcastId) || podcastId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Podcast not found" });
  }
  const podcastClient = usePodcastClient();
  const [podcast, dbData] = await Promise.all([
    withMediaServiceTimeout(() => podcastClient.getPodcast(podcastId), "iTunes podcast"),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(podcastId, "podcast", getQuery(event).projection),
  ]);

  if (!podcast) throw createError({ statusCode: 404, statusMessage: "Podcast not found" });
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
