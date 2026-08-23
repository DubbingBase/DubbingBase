import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { id, updates, isEditMode } = body;

    if (!updates || !updates.name) {
      throw createError({
        statusCode: 400,
        message: "Missing studio name in updates parameter",
      });
    }

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    if (isEditMode && id) {
      const { error } = await supabase
        .from("studios")
        .update(updates)
        .eq("id", Number(id));

      if (error) throw error;
      return { success: true, message: "Studio updated" };
    } else {
      const { error } = await supabase.from("studios").insert([updates]);

      if (error) throw error;
      return { success: true, message: "Studio created" };
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in save-studio:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
