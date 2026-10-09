import { requireAdmin } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";
const QUEUE_NAMES = ["wiki_scan", "wiki_discovery", "wiki_check", "wiki_extract"] as const;
const QUEUE_STATUSES = [
  "active",
  "archived",
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

function queryValue(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, message: `Invalid ${name}` });
  }
  return value;
}

function queryInteger(
  value: unknown,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw createError({ statusCode: 400, message: `Invalid ${name}` });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw createError({ statusCode: 400, message: `Invalid ${name}` });
  }
  return parsed;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const query = getQuery(event);
  const queueName = queryValue(query.queue, "queue");
  const status = queryValue(query.status, "status");
  if (queueName && !QUEUE_NAMES.some((name) => name === queueName)) {
    throw createError({ statusCode: 400, message: "Invalid queue" });
  }
  if (status && !QUEUE_STATUSES.some((candidate) => candidate === status)) {
    throw createError({ statusCode: 400, message: "Invalid status" });
  }

  const limit = queryInteger(query.limit, "limit", 100, 1, 500);
  const offset = queryInteger(query.offset, "offset", 0, 0, 100_000);
  const supabase = useSupabaseAdmin(event);

  const [queueResult, statsResult] = await Promise.all([
    supabase.rpc("get_media_queue_items", {
      p_queue_name: queueName ?? undefined,
      p_status: status ?? undefined,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc("get_media_queue_stats"),
  ]);

  if (queueResult.error) {
    throw createError({
      statusCode: 500,
      message: "Failed to read queue items",
    });
  }
  if (statsResult.error) {
    throw createError({
      statusCode: 500,
      message: "Failed to read queue statistics",
    });
  }

  const items = (queueResult.data ?? []).filter(
    (item) => !queueName || item.queue_name === queueName,
  );

  return { items, stats: statsResult.data };
});
