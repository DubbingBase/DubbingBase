import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const ids = body?.ids;

  if (!ids || !Array.isArray(ids)) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid ids parameter",
    });
  }

  const numIds = ids.map(Number).filter((id) => !isNaN(id));
  const results: Record<number, number> = {};
  for (const id of numIds) {
    results[id] = 0;
  }

  if (numIds.length === 0) {
    return results;
  }

  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("work")
    .select("voice_actor_id")
    .in("voice_actor_id", numIds);

  if (!error && data) {
    for (const row of data) {
      if (row.voice_actor_id) {
        results[row.voice_actor_id] = (results[row.voice_actor_id] || 0) + 1;
      }
    }
  }

  return results;
});
