import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { ApiError } from "../../../../../utils/api-v1/errors";
import { requireCredit } from "../../../../../utils/api-v1/credits";
import { mediaKey, mediaSegment } from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Delete a credit",
  tags: ["Credits"],
  scope: "credits:write",
  idempotent: true,
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  response: v.object({ deleted: v.boolean() }),
  handler: async ({ event, auth, params, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const row = await requireCredit(event, mediaKey(params.type, params.id), params.workId);
    const { error } = await useSupabaseAdmin(event).rpc("delete_voice_actor_work_link", {
      p_user_id: auth.userId,
      p_request_id: idempotencyKey,
      p_work_id: params.workId,
      p_expected_updated_at: row.updated_at,
    });
    if (error) {
      switch (error.code) {
        case "42501":
        case "28000":
          throw new ApiError(403, "forbidden", "Not allowed to delete this credit.");
        case "P0002":
          throw new ApiError(404, "not_found", "Credit not found.");
        case "55000":
        case "23505":
        case "40001":
        case "PT409":
          throw new ApiError(409, "conflict", "The credit was changed at the same time; retry.");
        default:
          console.error("delete_voice_actor_work_link failed", error.code ?? "unknown");
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    return { deleted: true };
  },
});

export default route.handler;
