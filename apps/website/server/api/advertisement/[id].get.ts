import { useCache, useAdvertisementClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
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

    setHeader(
      event,
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );

    const cache = useCache();
    const adClient = useAdvertisementClient();

    const cacheKey = `app:ad:${adId}`;
    const cached = await cache.get<AdvertisementResponse>(cacheKey);

    let baseData = cached;

    if (!baseData) {
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

      const { ad, failed } = apiData;
      const dubbingProjects = dbData;

      const isProcessed = dubbingProjects.length > 0;
      if (!isProcessed) {
        const supabaseAdmin = useSupabaseAdmin();
        void (async () => {
          const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
            p_media_type: "advertisement",
            p_tmdb_id: adId,
            p_season_number: undefined,
            p_episode_number: undefined,
          });
          if (error)
            console.error("Failed to lazily enqueue advertisement:", error);
        })();
      }

      baseData = {
        advertisement: ad,
        dubbingProjects,
        votes: {},
      };

      if (!failed) {
        await cache.set(cacheKey, baseData, "LONG");
      }
    }

    return baseData;
  },
);
