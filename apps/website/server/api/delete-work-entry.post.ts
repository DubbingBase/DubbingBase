import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  try {
    const body = await readBody(event);
    const { id } = body;
    if (!id) {
      throw createError({ statusCode: 400, message: "Missing id" });
    }

    const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

    const { error } = await supabaseAdmin.from("work").delete().eq("id", id);
    if (error) {
      throw createError({ statusCode: 500, message: error.message });
    }

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Invalid Request",
    });
  }
});
