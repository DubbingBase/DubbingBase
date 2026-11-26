import { getHeader, setHeader } from "h3";
import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { requireMedia, errorCode } from "../../../../utils/api-v1/credits";
import { CastOrderResponse, toCastOrderResponse } from "../../../../utils/api-v1/cast-order";
import { ApiError } from "../../../../utils/api-v1/errors";
import { mediaKey } from "../../../../utils/api-v1/media";
import { positiveId } from "../../../../utils/api-v1/voice-actors";
import {
  castOrderEtag,
  castOrderVersionFromEtag,
  GameCastOrderSchema,
  loadGameCastOrder,
} from "../../../../utils/cast-order";
import { useSupabaseAdmin } from "../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Replace a game's cast order",
  tags: ["Characters"],
  scope: "characters:update",
  params: v.object({ type: v.literal("games"), id: positiveId }),
  query: v.object({}),
  // The whole order, first = position 1. Characters left out become unranked. `If-Match` (the
  // ETag of `GET /games/{id}/cast-order`) is required, so an order changed in between is refused.
  body: v.strictObject({
    characters: v.pipe(
      v.array(v.pipe(v.string(), v.uuid(), v.toLowerCase())),
      v.maxLength(10000),
      v.check((ids) => new Set(ids).size === ids.length, "List each game character once."),
    ),
  }),
  response: CastOrderResponse,
  handler: async ({ event, auth, params, body }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const ifMatch = getHeader(event, "if-match");
    if (ifMatch === undefined) {
      throw new ApiError(
        428,
        "precondition_required",
        "Send the cast order's ETag as If-Match; read it with GET first.",
      );
    }
    const expectedVersion = castOrderVersionFromEtag(ifMatch);
    const current = await loadGameCastOrder(event, key.contentId);
    if (!current) throw new ApiError(404, "not_found", "Game not found.");
    if (expectedVersion === null) {
      throw new ApiError(412, "precondition_failed", "If-Match is not a cast order ETag.", {
        ETag: castOrderEtag(current.version),
      });
    }

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
    const { data, error } = await supabase.rpc("set_game_cast_order", {
      p_actor_id: auth.userId,
      p_igdb_game_id: key.contentId,
      p_character_ids: body.characters,
      p_expected_version: expectedVersion,
      p_origin: "api",
    });
    if (error) {
      switch (errorCode(error)) {
        case "PT412":
          throw new ApiError(
            412,
            "precondition_failed",
            "The cast order changed since you read it; read it again and retry.",
            { ETag: castOrderEtag(current.version) },
          );
        case "42501":
        case "28000":
          throw new ApiError(403, "forbidden", "Not allowed to order this game's cast.");
        case "23503":
          throw new ApiError(
            422,
            "invalid_reference",
            "Every character must be registered for this game (see the characters endpoint).",
          );
        case "P0002":
          throw new ApiError(404, "not_found", "Game not found.");
        case "40001":
        case "40P01":
        case "23505":
        case "23514":
          throw new ApiError(409, "conflict", "The cast order changed at the same time; retry.");
        default:
          console.error("set_game_cast_order failed", errorCode(error));
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const order = v.parse(GameCastOrderSchema, data);
    setHeader(event, "ETag", castOrderEtag(order.version));
    return toCastOrderResponse(order, key.contentId);
  },
});

export default route.handler;
