import { setHeader } from "h3";
import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import {
  Credit,
  creditCastRank,
  creditEtag,
  requireCredit,
  toCredit,
} from "../../../../../utils/api-v1/credits";
import { mediaKey, mediaSegment } from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";

export const route = defineApiRoute({
  summary: "Get a credit",
  tags: ["Credits"],
  scope: "credits:read",
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  response: Credit,
  handler: async ({ event, params }) => {
    const key = mediaKey(params.type, params.id);
    const row = await requireCredit(event, key, params.workId);
    setHeader(event, "ETag", creditEtag(row.updated_at, creditCastRank(row)));
    return toCredit(row, key.segment, key.contentId);
  },
});

export default route.handler;
