import { useCache, useOpenLibraryClient } from "../../utils";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import type { AudiobookResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<AudiobookResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const bookId = parseInt(id, 10);
  if (isNaN(bookId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const cache = useCache(event);
  const openLibraryClient = useOpenLibraryClient();

  const cacheKey = `app:audiobook:${bookId}`;
  const cached = await cache.get<AudiobookResponse>(cacheKey);

  let baseData = cached;

  if (!baseData) {
    // Fetch OpenLibrary book data + DB dubbing projects concurrently
    const [apiData, dbData] = await Promise.all([
      (async () => {
        try {
          const book = await openLibraryClient.getBook(bookId);
          return {
            failed: false,
            book,
          };
        } catch (err) {
          console.error(`Failed to fetch OpenLibrary book ${bookId}:`, err);
          return {
            failed: true,
            book: {
              id: bookId,
              title: "Livre audio",
              description: "Information indisponible",
              media_type: "audiobook" as const,
            },
          };
        }
      })(),

      // DB: dubbing projects
      getDubbingProjects(bookId, "audiobook"),
    ]);

    const { book, failed } = apiData;
    const dubbingProjects = dbData;

    // Lazy enqueue if not yet processed
    const isProcessed = dubbingProjects.length > 0;
    if (!isProcessed) {
      const supabaseAdmin = useSupabaseAdmin();
      const enqueueTask = async () => {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "audiobook",
          p_tmdb_id: bookId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) {
          if (!error.message?.includes("already in the")) {
            console.error("Failed to lazily enqueue audiobook:", error);
          }
        } else {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued audiobook **${book?.title || bookId}** (OpenLibrary ID: ${bookId}) for dubbing discovery.`,
            {
              ...(book?.cover_url ? { imageUrl: book.cover_url } : {}),
              url: `/audiobook/${bookId}`,
              color: 0x5865f2,
            },
          );
        }
      };

      if (event?.waitUntil) {
        event.waitUntil(enqueueTask());
      } else {
        void enqueueTask();
      }
    }

    baseData = {
      audiobook: book,
      dubbingProjects,
      votes: {},
    };

    if (!failed) {
      await cache.set(cacheKey, baseData, "LONG");
    }
  }

  return baseData;
});
