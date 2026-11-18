import { useOpenLibraryClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import type { AudiobookResponse } from "@app/shared-logic";
import { withMediaServiceTimeout } from "../../utils/media-request";

export default defineEventHandler(async (event): Promise<AudiobookResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const bookId = Number(id);
  if (!Number.isSafeInteger(bookId) || bookId < 1) {
    throw createError({
      statusCode: 404,
      statusMessage: "Audiobook not found",
    });
  }
  const openLibraryClient = useOpenLibraryClient();
  // Fetch OpenLibrary book data + DB dubbing projects concurrently
  const [apiData, dbData] = await Promise.all([
    withMediaServiceTimeout(() => openLibraryClient.getBook(bookId), "OpenLibrary book"),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(bookId, "audiobook", getQuery(event).projection),
  ]);

  const book = apiData;
  if (!book)
    throw createError({
      statusCode: 404,
      statusMessage: "Audiobook not found",
    });
  const dubbingProjects = dbData;

  const baseData = {
    audiobook: book,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
