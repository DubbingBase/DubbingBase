import { requireAdmin } from "../../../utils/auth";
import { useSupabaseAdmin } from "../../../utils/db/client";

const validQueueNames = ["wiki_extract", "wiki_check", "wiki_discovery"];

type DeleteQueueItemBody = {
  id?: unknown;
  queueName?: unknown;
};

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await readBody<DeleteQueueItemBody>(event);
  if (typeof body !== "object" || body === null) {
    throw createError({ statusCode: 400, message: "Invalid queue item" });
  }

  const { id, queueName } = body;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: "Invalid queue item ID" });
  }

  if (
    queueName !== undefined &&
    queueName !== null &&
    (typeof queueName !== "string" || !validQueueNames.includes(queueName))
  ) {
    throw createError({ statusCode: 400, message: "Invalid queue name" });
  }

  const { data, error } = await useSupabaseAdmin(event).rpc(
    "delete_media_queue_item",
    {
      p_id: id,
      p_queue_name: typeof queueName === "string" ? queueName : undefined,
    },
  );

  if (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to delete the media queue item",
    });
  }

  return { success: data };
});
