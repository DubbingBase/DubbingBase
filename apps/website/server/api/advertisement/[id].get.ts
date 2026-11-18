import { useAdvertisementClient } from "../../utils";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import type { AdvertisementResponse } from "@app/shared-logic";

export default defineEventHandler(async (event): Promise<AdvertisementResponse> => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const adId = Number(id);
  if (!Number.isSafeInteger(adId) || adId === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Advertisement not found",
    });
  }
  const adClient = useAdvertisementClient();
  const projection = getQuery(event).projection;
  const [ad, dbData] = await Promise.all([
    adClient.getAdvertisement(adId),

    // DB: dubbing projects
    getDubbingProjectsForMediaEndpoint(adId, "advertisement", projection),
  ]);

  if (!ad) {
    throw createError({
      statusCode: 404,
      statusMessage: "Advertisement not found",
    });
  }
  const dubbingProjects = dbData;

  const baseData = {
    advertisement: ad,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
