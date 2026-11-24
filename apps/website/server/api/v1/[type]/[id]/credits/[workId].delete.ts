import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import {
  mutateCredits,
  notifyCreditChange,
  requireCredit,
} from "../../../../../utils/api-v1/credits";
import { apiMediaPath, mediaKey, mediaSegment } from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";

export const route = defineApiRoute({
  summary: "Delete a credit",
  tags: ["Credits"],
  scope: "credits:write",
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  response: v.object({ deleted: v.boolean() }),
  handler: async ({ event, auth, params }) => {
    const key = mediaKey(params.type, params.id);
    const row = await requireCredit(event, key, params.workId);
    await mutateCredits(
      event,
      auth.userId,
      "delete",
      [{ work_id: params.workId, expected_updated_at: row.updated_at }],
      () => "The credit",
    );
    notifyCreditChange(event, auth.userId, {
      entityId: `${key.contentType}/${key.contentId}`,
      detail: `deleted credit #${params.workId}`,
      path: apiMediaPath(key.segment, key.contentId),
    });
    return { deleted: true };
  },
});

export default route.handler;
