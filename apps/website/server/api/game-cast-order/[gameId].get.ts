import { defineAdminHandler } from "../../utils/auth-handlers";
import { loadGameCastOrder } from "../../utils/cast-order";
import { gameCharacterError } from "../../utils/game-character-validation";

/** The game's cast order for the project editor: ranked characters at positions 1..n. */
export default defineAdminHandler(async (event) => {
  const gameId = Number(getRouterParam(event, "gameId"));
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw gameCharacterError(400, "Invalid game id");
  }
  // A game without a local record has nothing to order yet.
  return (await loadGameCastOrder(event, gameId)) ?? { version: 0, characters: [] };
});
