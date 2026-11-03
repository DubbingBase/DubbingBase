import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import {
  gameCharacterError,
  hasOnlyKeys,
  isRecord,
  isUuid,
} from "../utils/game-character-validation";

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const body: unknown = await readBody(event);

  if (!isRecord(body) || !hasOnlyKeys(body, ["request_id", "igdb_game_id", "name"])) {
    throw gameCharacterError(400, "Invalid game character request");
  }

  const gameId = body.igdb_game_id;
  const name = body.name;
  if (
    !isUuid(body.request_id) ||
    typeof gameId !== "number" ||
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 300
  ) {
    throw gameCharacterError(400, "Game character fields are invalid");
  }

  const { data, error } = await useSupabaseAdmin(event).rpc("create_game_character", {
    p_actor_id: admin.id,
    p_request_id: body.request_id,
    p_igdb_game_id: gameId,
    p_name: name,
  });

  if (error) {
    if (error.code === "42501") {
      throw gameCharacterError(403, "Game character creation is not authorized");
    }
    if (["23505", "55000", "40001"].includes(error.code)) {
      throw gameCharacterError(409, "This game character request is stale or was reused");
    }
    if (["22023", "23503", "22P02", "22003"].includes(error.code)) {
      throw gameCharacterError(422, "Game character fields are invalid");
    }
    console.error("Controlled game character creation failed", {
      code: error.code,
    });
    throw gameCharacterError(500, "Game character creation failed");
  }

  const result = data?.[0];
  if (!result) {
    throw gameCharacterError(500, "Game character creation failed");
  }

  return {
    character: {
      id: result.game_character_id,
      igdb_game_id: gameId,
      name: name.trim(),
      igdb_character_id: null,
      wikidata_qid: null,
    },
    auditLogId: result.audit_log_id,
    replayed: result.replayed,
  };
});
