import { isRecord } from "@app/shared-logic";
import { useSupabaseAdmin } from "../utils/db/client";

const MAX_IDS = 500;

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveIdList(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.length > 0 && value.length <= MAX_IDS && value.every(isPositiveId)
  );
}

function parseIds(value: unknown): number[] {
  if (!isPositiveIdList(value)) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid ids parameter",
    });
  }
  return value;
}

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event);
  const numIds = parseIds(isRecord(body) ? body.ids : undefined);

  const results: Record<number, number> = {};
  for (const id of numIds) {
    results[id] = 0;
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
