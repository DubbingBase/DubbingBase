import { requireAdmin } from "../../../utils/auth";
import { useSupabaseAdmin } from "../../../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const { error } = await useSupabaseAdmin(event).rpc("clear_media_queue");
  if (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to clear the media queue",
    });
  }

  return { success: true };
});
