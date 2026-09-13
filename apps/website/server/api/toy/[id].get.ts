import { useToyClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { setPublicCacheHeaders } from "../../utils/cache/http";
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

  setPublicCacheHeaders(event, "detail");

  const toyClient = useToyClient();
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

  const { toy } = apiData;
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
          p_media_type: "toy",
          p_tmdb_id: toyId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error && !error.message?.includes("already in the")) {
          console.error("Failed to lazily enqueue toy:", error);
        } else if (!error) {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued smart toy **${toy?.name || toyId}** (Toy ID: ${toyId}) for dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(toy?.cover_url ? { imageUrl: toy.cover_url } : {}),
              url: `/toy/${toyId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "toy discovery",
    );
  }

  const baseData = {
    toy,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
