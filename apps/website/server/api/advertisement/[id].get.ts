import { useAdvertisementClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import type { AdvertisementResponse } from "@app/shared-logic";

export default defineEventHandler(
  async (event): Promise<AdvertisementResponse> => {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({ statusCode: 400, message: "Missing id parameter" });
    }

    const adId = parseInt(id, 10);
    if (isNaN(adId)) {
      throw createError({ statusCode: 400, message: "Invalid id parameter" });
    }

    setPublicCacheHeaders(event, "detail");

    const adClient = useAdvertisementClient();
    const [apiData, dbData] = await Promise.all([
      (async () => {
        try {
          const ad = await adClient.getAdvertisement(adId);
          return {
            failed: false,
            ad,
          };
        } catch (err) {
          console.error(`Failed to fetch advertisement ${adId}:`, err);
          return {
            failed: true,
            ad: {
              id: adId,
              title: `Spot Publicitaire #${adId}`,
              brand: "Marque",
              media_type: "advertisement" as const,
            },
          };
        }
      })(),

      // DB: dubbing projects
      getDubbingProjects(adId, "advertisement"),
    ]);

    const { ad } = apiData;
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
  },
);
