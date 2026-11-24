import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { notifyCreditChange, requireMedia } from "../../../../utils/api-v1/credits";
import { ApiError } from "../../../../utils/api-v1/errors";
import { characterError, GameCharacterWrite } from "../../../../utils/api-v1/game-characters";
import { mediaKey, sitePath } from "../../../../utils/api-v1/media";
import { positiveId } from "../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Register a game character",
  tags: ["Characters"],
  scope: "characters:create",
  idempotent: true,
  params: v.object({ type: v.literal("games"), id: positiveId }),
  query: v.object({}),
  body: v.strictObject({
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
    /**
     * The character's id on IGDB, taken from IGDB itself. Stored as given: the API never calls
     * IGDB, so it cannot confirm the id belongs to this game.
     */
    igdb_character_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))), null),
  }),
  response: GameCharacterWrite,
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const { data, error } = await (event.context.supabaseAdmin || useSupabaseAdmin(event)).rpc(
      "api_create_game_character",
      {
        p_actor_id: auth.userId,
        p_request_id: idempotencyKey,
        p_igdb_game_id: key.contentId,
        p_name: body.name,
        p_igdb_character_id: body.igdb_character_id,
      },
    );
    if (error) throw characterError(error, "api_create_game_character");
    const result = v.parse(GameCharacterWrite, data);
    if (result.created) {
      notifyCreditChange(event, auth.userId, {
        entity: "game",
        entityId: `${key.contentType}/${key.contentId}`,
        detail: `game character "${result.name}" registered`,
        path: sitePath(key.segment, key.contentId),
        subject: `${key.contentType} #${key.contentId}`,
        tag: "API · character registered",
        fields: [{ name: "Character", value: result.name }],
      });
    }
    return result;
  },
});

export default route.handler;
