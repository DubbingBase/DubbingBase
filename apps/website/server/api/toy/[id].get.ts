import { useToyClient } from "../../utils";
import { getDubbingProjects, getToyPageDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import type { ToyResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<ToyResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const toyId = Number(id);
  if (!Number.isSafeInteger(toyId) || toyId === 0) {
    throw createError({ statusCode: 404, statusMessage: "Toy not found" });
  }
  const toyClient = useToyClient();
  const projection = getQuery(event).projection;
  const [toy, dbData] = await Promise.all([
    toyClient.getToy(toyId),

    // DB: dubbing projects
    projection === "media-page"
      ? getToyPageDubbingProjects(toyId)
      : getDubbingProjects(toyId, "toy"),
  ]);

  if (!toy) throw createError({ statusCode: 404, statusMessage: "Toy not found" });
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
