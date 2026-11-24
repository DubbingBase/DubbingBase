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
  sitePath,
  mediaKey,
  mediaSegment,
  performanceSchema,
} from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";

export const route = defineApiRoute({
  summary: "Change a credit's performance",
  tags: ["Credits"],
  scope: "credits:update",
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  body: v.strictObject({ performance: performanceSchema }),
  response: Credit,
  handler: async ({ event, auth, params, body }) => {
    const key = mediaKey(params.type, params.id);
    const row = await requireCredit(event, key, params.workId);
    const [written] = await mutateCredits(
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
      path: sitePath(key.segment, key.contentId),
    });
    // Answer from the row the transaction wrote, not a second read another request may have changed.
    const after = v.parse(
      v.object({
        performance: v.nullable(v.string()),
        updated_at: v.string(),
        note: v.nullable(v.string()),
        highlight: v.nullable(v.boolean()),
        reviewed_status: v.nullable(v.string()),
        character_name: v.nullable(v.string()),
        actor_id: v.nullable(v.number()),
        game_character_id: v.nullable(v.string()),
      }),
      written?.after,
    );
    return toCredit({ ...row, ...after }, key.segment, key.contentId);
  },
});

export default route.handler;
