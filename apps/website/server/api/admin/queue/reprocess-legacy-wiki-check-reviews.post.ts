import { defineAdminHandler } from "../../../utils/auth-handlers";
import { useSupabaseAdmin } from "../../../utils/db/client";

export default defineAdminHandler(async (event) => {
  const { data, error } = await useSupabaseAdmin(event).rpc("reprocess_legacy_wiki_check_reviews");

  if (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to reprocess legacy Wikipedia checks",
    });
  }

  return { outcomes: data };
});
