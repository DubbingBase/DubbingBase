import { resolveUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import {
  isHistoryEntityType,
  mediaPath,
  toHistoryEntry,
  type HistoryEntry,
  type HistoryResponse,
} from "../utils/entity-history";
import { evaluateRevert } from "../utils/history-revert";
import { currentRowKey, loadCurrentRows } from "../utils/history-store";

// Public, read-only change history (who changed which field, when, with before/after and deep
// links). Open editing relies on this transparency instead of an approval queue, so it needs
// no sign-in. Admins additionally get `canRevert` and per-entry `revertable` flags.
export default defineEventHandler(async (event): Promise<HistoryResponse> => {
  const query = getQuery(event);
  const type = typeof query.type === "string" ? query.type : undefined;
  const rawId = typeof query.id === "string" ? query.id : undefined;
  if (!isHistoryEntityType(type) || !rawId || !/^[1-9]\d{0,15}$/.test(rawId)) {
    throw createError({ statusCode: 400, message: "Invalid history request" });
  }

  const user = await resolveUser(event);
  const canRevert = user?.app_metadata?.role === "admin";
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
  const rows = data ?? [];

  // Cast credits link to the media they belong to, resolved from their dubbing project.
  const projectIds = new Set<number>();
  for (const row of rows) {
    for (const snapshot of [row.new_value, row.previous_value]) {
      const projectId =
        typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)
          ? snapshot.dubbing_project_id
          : undefined;
      if (typeof projectId === "number") projectIds.add(projectId);
    }
  }
  const mediaByProject = new Map<number, string>();
  if (projectIds.size > 0) {
    const { data: projects, error: projectsError } = await supabase
      .from("dubbing_projects")
      .select("id, content_id, content_type")
      .in("id", [...projectIds]);
    if (projectsError) {
      console.error("Failed to resolve history media links", { code: projectsError.code });
    }
    for (const project of projects ?? []) {
      const path = mediaPath(project.content_type, project.content_id);
      if (path) mediaByProject.set(project.id, path);
    }
  }

  const current = canRevert ? await loadCurrentRows(supabase, rows) : null;
  const entries: HistoryEntry[] = [];
  for (const row of rows) {
    const entry = toHistoryEntry(row, type, {
      mediaHref: (projectId) => mediaByProject.get(projectId) ?? null,
    });
    if (!entry) continue;
    if (current) {
      const evaluation = evaluateRevert(
        row,
        current.get(currentRowKey(row.entity_type, row.entity_id)) ?? null,
      );
      entry.revertable = evaluation.ok;
      entry.revertBlockedReason =
        evaluation.ok || evaluation.reason === "already_reverted" ? null : evaluation.reason;
    }
    entries.push(entry);
  }
  return { canRevert, entries };
});
