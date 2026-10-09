import { requireAdmin } from "../../../utils/auth";
import { useSupabaseAdmin } from "../../../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const { data, error } = await useSupabaseAdmin(event).rpc("reprocess_legacy_wiki_check_reviews");

  if (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to reprocess legacy Wikipedia checks",
    });
  }

  return { outcomes: data };
});
