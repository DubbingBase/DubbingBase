import { useOpenLibraryClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import type { AudiobookResponse } from "@app/shared-logic";
import { withMediaServiceTimeout } from "../../utils/media-request";

export default defineEventHandler(async (event): Promise<AudiobookResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const bookId = Number(id);
  if (!Number.isSafeInteger(bookId) || bookId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Audiobook not found" });
  }
  const openLibraryClient = useOpenLibraryClient();
  // Fetch OpenLibrary book data + DB dubbing projects concurrently
  const [apiData, dbData] = await Promise.all([
    withMediaServiceTimeout(() => openLibraryClient.getBook(bookId), "OpenLibrary book"),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(bookId, "audiobook", getQuery(event).projection),
  ]);

  const book = apiData;
  if (!book) throw createError({ statusCode: 404, statusMessage: "Audiobook not found" });
  const dubbingProjects = dbData;

  // Lazy enqueue if not yet processed - Gated by PostHog 'enqueue-on-navigate' (server-side)
  const isProcessed = dubbingProjects.length > 0;
  if (!isProcessed) {
    scheduleBackgroundTask(
      event,
      async () => {
        if (!(await isEnqueueOnNavigateEnabled())) return;
        const supabaseAdmin = useSupabaseAdmin(event);
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "audiobook",
          p_tmdb_id: bookId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error && !error.message?.includes("already in the")) {
          console.error("Failed to lazily enqueue audiobook:", error);
        } else if (!error) {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued audiobook **${book?.title || bookId}** (OpenLibrary ID: ${bookId}) for dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(book?.cover_url ? { imageUrl: book.cover_url } : {}),
              url: `/audiobook/${bookId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "audiobook discovery",
    );
  }

  const baseData = {
    audiobook: book,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
