import { requireAdmin } from "../../utils/auth";
import { useIgdbClient } from "../../utils";
import { useSupabaseAdmin } from "../../utils/db/client";

function referenceError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isExpectedTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const gameCharacterId = getRouterParam(event, "id");
  const body: unknown = await readBody(event);

  if (
    !isUuid(gameCharacterId) ||
    !isRecord(body) ||
    !hasOnlyKeys(body, [
      "request_id",
      "expected_updated_at",
      "igdb_character_id",
      "wikidata_qid",
    ]) ||
    !isUuid(body.request_id) ||
    !isExpectedTimestamp(body.expected_updated_at) ||
    !("igdb_character_id" in body || "wikidata_qid" in body) ||
    ("igdb_character_id" in body &&
      body.igdb_character_id !== null &&
      (typeof body.igdb_character_id !== "number" ||
        !Number.isSafeInteger(body.igdb_character_id) ||
        body.igdb_character_id <= 0)) ||
    ("wikidata_qid" in body &&
      body.wikidata_qid !== null &&
      (typeof body.wikidata_qid !== "string" || !/^Q[1-9][0-9]*$/.test(body.wikidata_qid)))
  ) {
    throw referenceError(400, "Game character references are invalid");
  }

  const references: {
    igdb_character_id?: number | null;
    wikidata_qid?: string | null;
  } = {};
  if ("igdb_character_id" in body) {
    const igdbCharacterId = body.igdb_character_id;
    if (igdbCharacterId === null || typeof igdbCharacterId === "number") {
      references.igdb_character_id = igdbCharacterId;
    }
  }
  if ("wikidata_qid" in body) {
    const wikidataQid = body.wikidata_qid;
    if (wikidataQid === null || typeof wikidataQid === "string") {
      references.wikidata_qid = wikidataQid;
    }
  }

  const supabase = useSupabaseAdmin(event);
  const igdbCharacterId = references.igdb_character_id;
  if (typeof igdbCharacterId === "number") {
    const { data: localCharacter, error: lookupError } = await supabase
      .from("game_characters")
      .select("igdb_game_id")
      .eq("id", gameCharacterId)
      .maybeSingle();
    if (lookupError) {
      throw referenceError(500, "Game character references could not be verified");
    }
    if (!localCharacter) {
      throw referenceError(404, "Game character does not exist");
    }

    let igdbCharacterBelongsToGame: boolean;
    try {
      igdbCharacterBelongsToGame = (
        await useIgdbClient().getGameCharacters(localCharacter.igdb_game_id)
      ).some((character) => character.id === igdbCharacterId);
    } catch {
      throw referenceError(503, "IGDB characters are unavailable; the link was not saved");
    }
    if (!igdbCharacterBelongsToGame) {
      throw referenceError(422, "The IGDB character does not belong to this game");
    }
  }

  const { data, error } = await supabase.rpc("update_game_character_references", {
    p_actor_id: admin.id,
    p_request_id: body.request_id,
    p_game_character_id: gameCharacterId,
    p_expected_updated_at: body.expected_updated_at,
    p_references: references,
  });

  if (error) {
    if (error.code === "42501") {
      throw referenceError(403, "Game character reference update is not authorized");
    }
    if (["23505", "55000", "40001"].includes(error.code)) {
      throw referenceError(
        409,
        "Game character references changed or conflict with another mapping",
      );
    }
    if (["22023", "23503", "22P02", "22003"].includes(error.code)) {
      throw referenceError(422, "Game character references are invalid");
    }
    console.error("Controlled game character reference update failed", {
      code: error.code,
    });
    throw referenceError(500, "Game character references could not be updated");
  }

  const result = data?.[0];
  if (!result) {
    throw referenceError(500, "Game character references could not be updated");
  }

  return {
    game_character_id: result.game_character_id,
    updated_at: result.updated_at,
    audit_log_id: result.audit_log_id,
    replayed: result.replayed,
  };
});
