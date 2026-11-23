import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { ApiError } from "../../../../../utils/api-v1/errors";
import { Credit, requireCredit, toCredit } from "../../../../../utils/api-v1/credits";
import { mediaKey, performanceSchema, mediaSegment } from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Change a credit's performance",
  tags: ["Credits"],
  scope: "credits:write",
  idempotent: true,
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  body: v.strictObject({ performance: performanceSchema }),
  response: Credit,
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const key = mediaKey(params.type, params.id);
    const row = await requireCredit(event, key, params.workId);
    const { error } = await useSupabaseAdmin(event).rpc("update_voice_actor_work_performance", {
      p_user_id: auth.userId,
      p_request_id: idempotencyKey,
      p_work_id: params.workId,
      p_expected_updated_at: row.updated_at,
      p_performance: body.performance,
    });
    if (error) {
      switch (error.code) {
        case "42501":
        case "28000":
          throw new ApiError(403, "forbidden", "Not allowed to change this credit.");
        case "22023":
          throw new ApiError(400, "invalid_request", "The change is invalid.");
        case "P0002":
          throw new ApiError(404, "not_found", "Credit not found.");
        case "55000":
        case "23505":
        case "40001":
        case "PT409":
          throw new ApiError(409, "conflict", "The credit was changed at the same time; retry.");
        default:
          console.error("update_voice_actor_work_performance failed", error.code ?? "unknown");
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    return toCredit(await requireCredit(event, key, params.workId), key.segment, key.contentId);
  },
});

export default route.handler;
