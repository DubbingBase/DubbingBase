import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { type, payload } = body;

    if (!type || !payload) {
      throw createError({
        statusCode: 400,
        message: "Missing type or payload",
      });
    }

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    if (type === "job") {
      const { data, error } = await supabase
        .from("jobs")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return { data };
    } else if (type === "voice_actor") {
      const { data, error } = await supabase
        .from("voice_actors")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return { data };
    }

    throw createError({
      statusCode: 400,
      message: "Invalid type parameter",
    });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in save-metadata:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
