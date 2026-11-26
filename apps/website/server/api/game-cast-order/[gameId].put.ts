import { isRecord } from "@app/shared-logic";
import * as v from "valibot";
import { defineAdminHandler } from "../../utils/auth-handlers";
import { GameCastOrderSchema } from "../../utils/cast-order";
import { useSupabaseAdmin } from "../../utils/db/client";
import { gameCharacterError, hasOnlyKeys, isUuid } from "../../utils/game-character-validation";

/**
 * Replaces the game's cast order from the project editor. The editor sends the version it loaded,
 * so an order changed in another tab, language or through the API is refused, never mixed in.
 */
export default defineAdminHandler(async (event, admin) => {
  const gameId = Number(getRouterParam(event, "gameId"));
  const body: unknown = await readBody(event);
  if (
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    !isRecord(body) ||
    !hasOnlyKeys(body, ["expected_version", "characters"]) ||
    typeof body.expected_version !== "number" ||
    !Number.isSafeInteger(body.expected_version) ||
    body.expected_version < 0 ||
    !Array.isArray(body.characters) ||
    body.characters.length > 10000
  ) {
    throw gameCharacterError(400, "Invalid cast order");
  }
  const characters: string[] = [];
  for (const id of body.characters) {
    if (!isUuid(id) || characters.includes(id.toLowerCase())) {
      throw gameCharacterError(400, "Invalid cast order");
    }
    characters.push(id.toLowerCase());
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase.rpc("set_game_cast_order", {
    p_actor_id: admin.id,
    p_igdb_game_id: gameId,
    p_character_ids: characters,
    p_expected_version: body.expected_version,
    p_origin: "website",
  });
  if (error) {
    if (error.code === "PT412" || ["40001", "40P01", "23505", "23514"].includes(error.code)) {
      throw gameCharacterError(409, "The cast order changed elsewhere; reload it before saving");
    }
    if (error.code === "42501") throw gameCharacterError(403, "Cast ordering is not authorized");
    if (error.code === "P0002") throw gameCharacterError(404, "Game not found");
    if (["22023", "23503", "22P02"].includes(error.code)) {
      throw gameCharacterError(422, "A character does not belong to this game");
    }
    console.error("Cast order save failed", { code: error.code });
    throw gameCharacterError(500, "Cast order save failed");
  }
  return v.parse(GameCastOrderSchema, data);
});
