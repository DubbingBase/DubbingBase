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
    const row = await requireCredit(event, key, params.workId);
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
      }),
      written?.after,
    );
    return toCredit({ ...row, ...after }, key.segment, key.contentId);
  },
});

export default route.handler;
