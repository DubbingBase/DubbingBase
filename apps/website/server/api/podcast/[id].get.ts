import { useCache, usePodcastClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
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

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const cache = useCache();
  const podcastClient = usePodcastClient();

  const cacheKey = `app:podcast:${podcastId}`;
  const cached = await cache.get<PodcastResponse>(cacheKey);

  let baseData = cached;

  if (!baseData) {
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

    const { podcast, failed } = apiData;
    const dubbingProjects = dbData;

    const isProcessed = dubbingProjects.length > 0;
    if (!isProcessed) {
      const supabaseAdmin = useSupabaseAdmin();
      void (async () => {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "podcast",
          p_tmdb_id: podcastId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) console.error("Failed to lazily enqueue podcast:", error);
      })();
    }

    baseData = {
      podcast,
      dubbingProjects,
      votes: {},
    };

    if (!failed) {
      await cache.set(cacheKey, baseData, "LONG");
    }
  }

  return baseData;
});
