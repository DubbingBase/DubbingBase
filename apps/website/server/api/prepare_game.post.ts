import { requireDubbingLanguage } from "../utils/dubbing-language";
import type { DubbingLanguage } from "@app/shared-logic";
import { requireUser } from "../utils/auth";
import { prepareGame } from "../utils/services/media-preparation";

export default defineEventHandler(async (event) => {
  requireUser(event);

  let igdbId: number;

  let language: string;
  let dubbingLanguage: DubbingLanguage;

  try {
    const body = await readBody(event);
    language = body.wikipedia_language ?? body.language;
    if (typeof language !== "string" || !/^[a-z][a-z0-9-]*$/.test(language)) {
      throw new Error("A Wikipedia source language is required");
    }
    dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
    igdbId = Number(body.igdbId);
    if (isNaN(igdbId)) throw new Error("igdbId must be a number");
  } catch (err) {
    throw createError({
      statusCode: 400,
      message:
        "Invalid request payload: " +
        (err instanceof Error ? err.message : String(err)),
    });
  }

  return await prepareGame({ igdbId, language, dubbingLanguage });
});
