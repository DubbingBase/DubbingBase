import { requireDubbingLanguage } from "../utils/dubbing-language";
import type { DubbingLanguage } from "@app/shared-logic";
import { requireUser } from "../utils/auth";
import { prepareMedia } from "../utils/services/media-preparation";

export default defineEventHandler(async (event) => {
  requireUser(event);

  let tmdbId: number;
  let type: "movie" | "tv" | "season" | "episode";
  let seasonNumber: number | null = null;
  let episodeNumber: number | null = null;

  let language: string;
  let dubbingLanguage: DubbingLanguage;

  try {
    const body = await readBody(event);
    language = body.wikipedia_language ?? body.language;
    if (typeof language !== "string" || !/^[a-z][a-z0-9-]*$/.test(language)) {
      throw new Error("A Wikipedia source language is required");
    }
    dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
    tmdbId = Number(body.tmdbId);
    type = body.type;
    if (body.seasonNumber !== undefined && body.seasonNumber !== null) {
      seasonNumber = Number(body.seasonNumber);
    }
    if (body.episodeNumber !== undefined && body.episodeNumber !== null) {
      episodeNumber = Number(body.episodeNumber);
    }
  } catch (err) {
    throw createError({
      statusCode: 400,
      message:
        "Invalid request payload: " +
        (err instanceof Error ? err.message : String(err)),
    });
  }

  return await prepareMedia({
    tmdbId,
    type,
    language,
    dubbingLanguage,
    seasonNumber,
    episodeNumber,
  });
});
