import { defineAdminHandler } from "../../../utils/auth-handlers";
import { useSupabaseAdmin } from "../../../utils/db/client";

export default defineAdminHandler(async (event) => {
  const { error } = await useSupabaseAdmin(event).rpc("clear_media_queue");
  if (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to clear the media queue",
    });
  }

  return { success: true };
});
