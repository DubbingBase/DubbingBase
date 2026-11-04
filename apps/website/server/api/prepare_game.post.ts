import { defineUserHandler } from "../utils/auth-handlers";
import { prepareGame } from "../utils/services/media-preparation";
import { prepareGameFromPayload } from "../utils/prepare-payload";

export default defineUserHandler(async (event) => {
  const result = await prepareGameFromPayload(await readBody(event), prepareGame);
  if (!result.ok) {
    throw createError({
      statusCode: 400,
      message: `Invalid request payload: ${result.reason}`,
    });
  }

  return result.value;
});
