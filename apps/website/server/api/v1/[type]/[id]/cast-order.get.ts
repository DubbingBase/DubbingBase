import { setHeader } from "h3";
import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { requireMedia } from "../../../../utils/api-v1/credits";
import { CastOrderResponse, toCastOrderResponse } from "../../../../utils/api-v1/cast-order";
import { ApiError } from "../../../../utils/api-v1/errors";
import { mediaKey } from "../../../../utils/api-v1/media";
import { positiveId } from "../../../../utils/api-v1/voice-actors";
import { castOrderEtag, loadGameCastOrder } from "../../../../utils/cast-order";

export const route = defineApiRoute({
  summary: "Get a game's cast order",
  tags: ["Characters"],
  scope: "characters:read",
  params: v.object({ type: v.literal("games"), id: positiveId }),
  query: v.object({}),
  response: CastOrderResponse,
  handler: async ({ event, params }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const order = await loadGameCastOrder(event, key.contentId);
    if (!order) throw new ApiError(404, "not_found", "Game not found.");
    setHeader(event, "ETag", castOrderEtag(order.version));
    return toCastOrderResponse(order, key.contentId);
  },
});

export default route.handler;
