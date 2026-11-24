import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { requireMedia } from "../../../../../utils/api-v1/credits";
import { ApiError } from "../../../../../utils/api-v1/errors";
import { characterError, GameCharacter } from "../../../../../utils/api-v1/game-characters";
import { mediaKey } from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Link a game character to IGDB or Wikidata",
  tags: ["Characters"],
  scope: "characters:update",
  idempotent: true,
  params: v.object({
    type: v.literal("games"),
    id: positiveId,
    characterId: v.pipe(v.string(), v.uuid(), v.toLowerCase()),
  }),
  query: v.object({}),
  body: v.strictObject({
    references: v.pipe(
      v.strictObject({
        /** IGDB character id, stored as given (never checked against IGDB); null unlinks. */
        igdb_character_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
        /** Wikidata item such as Q42; null unlinks. */
        wikidata_qid: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^Q[1-9][0-9]*$/)))),
      }),
      v.check((references) => Object.keys(references).length > 0, "give at least one reference"),
    ),
  }),
  response: GameCharacter,
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
    // The database function wants the character's current version; a change in between is a
    // retryable 409 rather than a lost update.
    const { data: character, error: readError } = await eqMediaRef(
      supabase.from("game_characters").select(`id, updated_at, ${MEDIA_FILTER_EMBED}`),
      key.contentType,
      key.contentId,
    )
      .eq("id", params.characterId)
      .maybeSingle();
    if (readError) throw readError;
    if (!character) throw new ApiError(404, "not_found", "Game character not found.");

    const { data, error } = await supabase.rpc("api_update_game_character_references", {
      p_actor_id: auth.userId,
      p_request_id: idempotencyKey,
      p_game_character_id: character.id,
      p_expected_updated_at: character.updated_at,
      p_references: body.references,
    });
    if (error) throw characterError(error, "api_update_game_character_references");
    return v.parse(GameCharacter, data);
  },
});

export default route.handler;
