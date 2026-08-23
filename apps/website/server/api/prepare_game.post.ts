import { requireUser } from "../utils/auth";
import { prepareGame } from "../utils/services/media-preparation";

export default defineEventHandler(async (event) => {
  requireUser(event);

  let igdbId: number;

  try {
    const body = await readBody(event);
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

  return await prepareGame({ igdbId });
});
