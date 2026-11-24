import * as v from "valibot";
import { ApiError } from "./errors";
import { errorCode } from "./credits";

/** A game character as the character endpoints return it. */
export const GameCharacter = v.object({
  game_character_id: v.string(),
  name: v.string(),
  /** The IGDB character this one is linked to; stored as given, never checked against IGDB. */
  igdb_character_id: v.nullable(v.number()),
  wikidata_qid: v.nullable(v.string()),
  /** Last change; the API handles concurrency itself, so you never send it back. */
  updated_at: v.string(),
});

export const GameCharacterWrite = v.object({
  ...GameCharacter.entries,
  /** False when a character with that name already existed for the game and was returned as is. */
  created: v.boolean(),
});

/** Maps a failed character RPC to an API error. */
export function characterError(error: unknown, rpc: string): ApiError {
  switch (errorCode(error)) {
    case "42501":
      return new ApiError(403, "forbidden", "Not allowed to change game characters.");
    case "P0002":
      return new ApiError(404, "not_found", "Game not found.");
    case "22023":
      return new ApiError(422, "invalid_request", "The character fields are invalid.");
    case "23503":
      return new ApiError(404, "not_found", "Game character not found.");
    case "23505":
      return new ApiError(
        409,
        "conflict",
        "That IGDB or Wikidata id is already linked to another character of this game.",
      );
    case "55000":
    case "40001":
    case "PT409":
      return new ApiError(409, "conflict", "The character changed at the same time; retry.");
    default:
      console.error(`${rpc} failed`, errorCode(error));
      return new ApiError(500, "internal_error", "Internal server error.");
  }
}
