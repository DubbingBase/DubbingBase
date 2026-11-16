import { useSupabaseAdmin } from "../utils/db/client";
import { isHistoryEntityType, toHistoryEntry, type HistoryEntry } from "../utils/entity-history";

// Public, read-only change history (who changed which field, when, with before/after). Open
// editing relies on this transparency instead of an approval queue, so it needs no sign-in.
export default defineEventHandler(async (event): Promise<{ entries: HistoryEntry[] }> => {
  const query = getQuery(event);
  const type = typeof query.type === "string" ? query.type : undefined;
  const rawId = typeof query.id === "string" ? query.id : undefined;
  if (!isHistoryEntityType(type) || !rawId || !/^[1-9]\d{0,15}$/.test(rawId)) {
    throw createError({ statusCode: 400, message: "Invalid history request" });
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase.rpc("get_entity_history", {
    p_entity_type: type,
    p_entity_id: Number(rawId),
    p_limit: 50,
  });
  if (error) {
    console.error("Failed to load entity history", { code: error.code });
    throw createError({ statusCode: 500, message: "Failed to load history" });
  }

  const entries: HistoryEntry[] = [];
  for (const row of data ?? []) {
    const entry = toHistoryEntry(row, type);
    if (entry) entries.push(entry);
  }
  return { entries };
});
