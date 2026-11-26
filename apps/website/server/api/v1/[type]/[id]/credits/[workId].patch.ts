import { getHeader, setHeader } from "h3";
import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { ApiError } from "../../../../../utils/api-v1/errors";
import {
  Credit,
  creditCastRank,
  creditEtag,
  mutateCredits,
  notifyCreditChange,
  requireCredit,
  toCredit,
} from "../../../../../utils/api-v1/credits";
import {
  castRankSchema,
  sitePath,
  mediaKey,
  mediaSegment,
  performanceSchema,
} from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";
import {
  applyCastPlacements,
  castPlacementMessage,
  loadGameCastOrder,
} from "../../../../../utils/cast-order";

export const route = defineApiRoute({
  summary: "Change a credit",
  tags: ["Credits"],
  scope: "credits:update",
  params: v.object({ type: mediaSegment, id: positiveId, workId: positiveId }),
  query: v.object({}),
  // Only the fields sent change. A credit keeps its id, history and review state, so a credit
  // without a character is completed here instead of being deleted and created again.
  body: v.pipe(
    v.strictObject({
      performance: v.optional(performanceSchema),
      /** Sets the character name; a name cannot be cleared. */
      character_name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300))),
      /** TMDB person id (movies, shows) or IGDB character id (games); null removes it. */
      actor_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
      /** A character registered for this game (games only); null removes the link. */
      game_character_id: v.optional(v.nullable(v.pipe(v.string(), v.uuid(), v.toLowerCase()))),
      /** Flags the credit as a main character (true) or clears the flag (false). */
      highlight: v.optional(v.boolean()),
      /**
       * Games only: moves the credit's game character to this position of the game's cast order
       * (1 = first, shared by every language); the characters after it shift down. Null takes it
       * out of the order. The credit must be linked to a game character, and the rank can be at
       * most one past the end of the order.
       */
      cast_rank: v.optional(v.nullable(castRankSchema)),
    }),
    v.check((body) => Object.keys(body).length > 0, "Send at least one field to change."),
    v.check(
      (body) => !(body.actor_id != null && body.game_character_id != null),
      "Use either actor_id or game_character_id.",
    ),
  ),
  response: Credit,
  handler: async ({ event, auth, params, body }) => {
    const key = mediaKey(params.type, params.id);
    if (body.cast_rank !== undefined && key.contentType !== "video_game") {
      throw new ApiError(400, "invalid_request", "cast_rank: only game credits can be ranked.");
    }
    const row = await requireCredit(event, key, params.workId);
    const etag = creditEtag(row.updated_at, creditCastRank(row));
    // With If-Match the caller's version must still be the current one; without it the write
    // applies to whatever is current.
    const ifMatch = getHeader(event, "if-match");
    if (ifMatch !== undefined && ifMatch !== etag) {
      throw new ApiError(
        412,
        "precondition_failed",
        "The credit changed since you read it; read it again and retry.",
        { ETag: etag },
      );
    }
    // A rank moves the credit's game character in the game's cast order. Check it against the order
    // now, and send the order's version so a change in between is refused instead of mixed in.
    let castOrderVersion: number | undefined;
    if (body.cast_rank !== undefined) {
      const gameCharacterId =
        body.game_character_id !== undefined ? body.game_character_id : row.game_character_id;
      if (gameCharacterId === null) {
        throw new ApiError(
          409,
          "unlinked_credit",
          "cast_rank: the cast order lists game characters; link this credit with game_character_id first.",
        );
      }
      const order = await loadGameCastOrder(event, key.contentId);
      if (!order) throw new ApiError(404, "not_found", "Game not found.");
      const placed = applyCastPlacements(
        order.characters.map((character) => character.game_character_id),
        [{ gameCharacterId, rank: body.cast_rank }],
      );
      if (!placed.ok) {
        throw new ApiError(422, "invalid_request", `cast_rank: ${castPlacementMessage(placed)}`);
      }
      castOrderVersion = order.version;
    }
    const [written] = await mutateCredits(
      event,
      auth.userId,
      "update",
      [
        {
          work_id: params.workId,
          expected_updated_at: row.updated_at,
          // Only the fields that were sent, so the others stay as they are.
          ...body,
          ...(castOrderVersion !== undefined ? { cast_order_version: castOrderVersion } : {}),
        },
      ],
      () => "The credit",
    );
    notifyCreditChange(event, auth.userId, {
      entityId: `${key.contentType}/${key.contentId}`,
      detail: `credit #${params.workId} ${Object.keys(body).join(", ")} changed`,
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
        cast_rank: v.nullable(v.number()),
      }),
      written?.after,
    );
    setHeader(event, "ETag", creditEtag(after.updated_at, after.cast_rank));
    return toCredit(
      {
        ...row,
        ...after,
        game_character:
          after.cast_rank === null ? null : { cast_order: { position: after.cast_rank } },
      },
      key.segment,
      key.contentId,
    );
  },
});

export default route.handler;
