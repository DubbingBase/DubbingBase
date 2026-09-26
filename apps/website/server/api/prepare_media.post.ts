import { requireUser } from "../utils/auth";
import { prepareMedia } from "../utils/services/media-preparation";
import { validatePrepareMediaPayload } from "../utils/prepare-payload";

export default defineEventHandler(async (event) => {
  requireUser(event);

  const valid = validatePrepareMediaPayload(await readBody(event));
  if (!valid.ok) {
    throw createError({
      statusCode: 400,
      message: `Invalid request payload: ${valid.reason}`,
    });
  }

  return await prepareMedia(valid.value);
});
