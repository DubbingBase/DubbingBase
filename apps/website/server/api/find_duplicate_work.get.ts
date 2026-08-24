import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

interface Work {
  id: number;
  dubbing_project_id: number;
  actor_id: number;
  voice_actor_id: number | null;
  status?: string | null;
  performance?: string | null;
}

function duplicateKey(row: Work): string {
  return `${row.dubbing_project_id}|${row.actor_id}|${row.voice_actor_id ?? "null"}`;
}

function processWorksBatch(
  works: Work[],
  existingGroups: Record<string, Work[]> = {},
): Record<string, Work[]> {
  const groups = { ...existingGroups };

  for (const work of works) {
    const key = duplicateKey(work);
    if (!groups[key]) groups[key] = [];
    groups[key].push(work);
  }

  return groups;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();

  try {
    const BATCH_SIZE = 1000;
    let cursor = 0;
    let hasMore = true;
    let groups: Record<string, Work[]> = {};

    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from("work")
        .select(
          "id, dubbing_project_id, actor_id, voice_actor_id, status, performance",
        )
        .order("id", { ascending: true })
        .range(cursor, cursor + BATCH_SIZE - 1);

      if (error) throw error;

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        groups = processWorksBatch(batch as Work[], groups);
        cursor += batch.length;

        if (batch.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    const duplicates = Object.values(groups)
      .filter((group) => group.length > 1)
      .map((works) => ({
        works: works.map((work) => ({
          id: work.id,
          dubbing_project_id: work.dubbing_project_id,
          actor_id: work.actor_id,
          voice_actor_id: work.voice_actor_id,
          status: work.status,
          performance: work.performance,
        })),
      }));

    return duplicates;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error finding duplicate works:", errorMessage);

    throw createError({
      statusCode: 500,
      message: "Failed to process request",
    });
  }
});
