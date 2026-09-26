import { requireUser } from "../utils/auth";
import { prepareGame } from "../utils/services/media-preparation";
import { prepareGameFromPayload } from "../utils/prepare-payload";

export default defineEventHandler(async (event) => {
  requireUser(event);

  const result = await prepareGameFromPayload(await readBody(event), prepareGame);
  if (!result.ok) {
    throw createError({
      statusCode: 400,
      message: `Invalid request payload: ${result.reason}`,
    });
  }

  return result.value;
});
