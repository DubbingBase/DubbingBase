import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import {
  Credit,
  mutateCredits,
  notifyCreditChange,
  requireCredit,
  toCredit,
} from "../../../../../utils/api-v1/credits";
import {
  apiMediaPath,
  mediaKey,
  mediaSegment,
  performanceSchema,
} from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";

export const route = defineApiRoute({
  summary: "Change a credit's performance",
  tags: ["Credits"],
  scope: "credits:write",
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  body: v.strictObject({ performance: performanceSchema }),
  response: Credit,
  handler: async ({ event, auth, params, body }) => {
    const key = mediaKey(params.type, params.id);
    const row = await requireCredit(event, key, params.workId);
    await mutateCredits(
      event,
      auth.userId,
      "update",
      [
        {
          work_id: params.workId,
          expected_updated_at: row.updated_at,
          performance: body.performance,
        },
      ],
      () => "The credit",
    );
    notifyCreditChange(event, auth.userId, {
      entityId: `${key.contentType}/${key.contentId}`,
      detail: `credit #${params.workId} performance set to ${body.performance}`,
      path: apiMediaPath(key.segment, key.contentId),
    });
    return toCredit(await requireCredit(event, key, params.workId), key.segment, key.contentId);
  },
});

export default route.handler;
