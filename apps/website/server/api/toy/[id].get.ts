import { useCache, useToyClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import type { ToyResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<ToyResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const toyId = parseInt(id, 10);
  if (isNaN(toyId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const cache = useCache(event);
  const toyClient = useToyClient();

  const cacheKey = `app:toy:${toyId}`;
  const cached = await cache.get<ToyResponse>(cacheKey);

  let baseData = cached;

  if (!baseData) {
    const [apiData, dbData] = await Promise.all([
      (async () => {
        try {
          const toy = await toyClient.getToy(toyId);
          return {
            failed: false,
            toy,
          };
        } catch (err) {
          console.error(`Failed to fetch toy ${toyId}:`, err);
          return {
            failed: true,
            toy: {
              id: toyId,
              name: `Jouet Connecté #${toyId}`,
              manufacturer: "Fabricant",
              media_type: "toy" as const,
            },
          };
        }
      })(),

      // DB: dubbing projects
      getDubbingProjects(toyId, "toy"),
    ]);

    const { toy, failed } = apiData;
    const dubbingProjects = dbData;

    const isProcessed = dubbingProjects.length > 0;
    if (!isProcessed) {
      const supabaseAdmin = useSupabaseAdmin();
      try {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "toy",
          p_tmdb_id: toyId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) {
          if (!error.message?.includes("already in the")) {
            console.error("Failed to lazily enqueue toy:", error);
          }
        } else {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued smart toy **${toy?.name || toyId}** (Toy ID: ${toyId}) for dubbing discovery.`,
            {
              ...(toy?.cover_url ? { imageUrl: toy.cover_url } : {}),
              url: `/toy/${toyId}`,
              color: 0x5865f2,
            },
          );
        }
      } catch (err) {
        console.error("Error auto-enqueueing toy:", err);
      }
    }

    baseData = {
      toy,
      dubbingProjects,
      votes: {},
    };

    if (!failed) {
      await cache.set(cacheKey, baseData, "LONG");
    }
  }

  return baseData;
});
