import { useAdvertisementClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import type { AdvertisementResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<AdvertisementResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const adId = Number(id);
  if (!Number.isSafeInteger(adId) || adId === 0) {
    throw createError({ statusCode: 404, statusMessage: "Advertisement not found" });
  }
  const adClient = useAdvertisementClient();
  const projection = getQuery(event).projection;
  const [ad, dbData] = await Promise.all([
    adClient.getAdvertisement(adId),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(adId, "advertisement", projection),
  ]);

  if (!ad) {
    throw createError({ statusCode: 404, statusMessage: "Advertisement not found" });
  }
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
          p_media_type: "advertisement",
          p_tmdb_id: adId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error && !error.message?.includes("already in the")) {
          console.error("Failed to lazily enqueue advertisement:", error);
        } else if (!error) {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued advertisement **${ad?.title || adId}** (Ad ID: ${adId}) for dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(ad?.poster_url ? { imageUrl: ad.poster_url } : {}),
              url: `/advertisement/${adId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "advertisement discovery",
    );
  }

  const baseData = {
    advertisement: ad,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
