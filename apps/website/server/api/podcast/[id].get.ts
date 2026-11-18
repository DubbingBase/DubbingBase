import { usePodcastClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import type { PodcastResponse } from "@app/shared-logic";
import { withMediaServiceTimeout } from "../../utils/media-request";

export default defineEventHandler(async (event): Promise<PodcastResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const podcastId = Number(id);
  if (!Number.isSafeInteger(podcastId) || podcastId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Podcast not found" });
  }
  const podcastClient = usePodcastClient();
  const [podcast, dbData] = await Promise.all([
    withMediaServiceTimeout(() => podcastClient.getPodcast(podcastId), "iTunes podcast"),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(podcastId, "podcast", getQuery(event).projection),
  ]);

  if (!podcast) throw createError({ statusCode: 404, statusMessage: "Podcast not found" });
  const dubbingProjects = dbData;

  const baseData = {
    podcast,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
