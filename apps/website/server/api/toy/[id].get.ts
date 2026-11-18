import { useToyClient } from "../../utils";
import {
  getDubbingProjects,
  getMediaPageDubbingProjectSummaries,
  getToyPageDubbingProjects,
} from "../../utils/db/queries";
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
    projection === "media-summary"
      ? getMediaPageDubbingProjectSummaries(toyId, "toy")
      : projection === "media-page"
        ? getToyPageDubbingProjects(toyId)
        : getDubbingProjects(toyId, "toy"),
  ]);

  if (!toy) throw createError({ statusCode: 404, statusMessage: "Toy not found" });
  const dubbingProjects = dbData;

  const baseData = {
    toy,
    dubbingProjects,
    votes: {},
  };

  return baseData;
});
