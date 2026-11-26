import * as v from "valibot";
import type { GameCastOrder } from "../cast-order";
import { apiMediaPath } from "./media";

/** A game's cast order as the API returns it: ranked characters, first = position 1. */
export const CastOrderResponse = v.object({
  path: v.string(),
  /** Changes with every write; the ETag carries it. 0 = the game was never ordered. */
  version: v.number(),
  /**
   * Ranked characters at positions 1..n, never tied or skipped. Characters not listed are unranked
   * and come after them on the game page; new characters are never added implicitly.
   */
  characters: v.array(
    v.object({
      position: v.number(),
      game_character_id: v.string(),
      name: v.string(),
    }),
  ),
});

export function toCastOrderResponse(
  order: GameCastOrder,
  igdbGameId: number,
): v.InferOutput<typeof CastOrderResponse> {
  const base = apiMediaPath("games", igdbGameId);
  return {
    path: `${base}/cast-order`,
    version: order.version,
    characters: order.characters.map((character) => ({
      position: character.position,
      game_character_id: character.game_character_id,
      name: character.name,
    })),
  };
}
