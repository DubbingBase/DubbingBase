import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const { work_id, vote_type } = body || {};

  if (!work_id || !vote_type) {
    throw createError({
      statusCode: 400,
      message: "Missing work_id or vote_type",
    });
  }

  if (!["up", "down"].includes(vote_type)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid vote_type. Must be "up" or "down"',
    });
  }

  const workId = parseInt(String(work_id), 10);
  if (isNaN(workId)) {
    throw createError({ statusCode: 400, message: "Invalid work_id" });
  }

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  const { error } = await supabaseAdmin.from("votes").upsert(
    {
      user_id: user.id,
      work_id: workId,
      vote_type,
    },
    {
      onConflict: "user_id,work_id",
    },
  );

  if (error) {
    console.error("Error upserting vote:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to cast vote",
    });
  }

  return { success: true };
});
