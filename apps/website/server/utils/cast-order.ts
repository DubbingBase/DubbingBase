import type { H3Event } from "h3";
import * as v from "valibot";
import { useSupabaseAdmin } from "./db/client";

/**
 * A game's cast order: its characters at positions 1..n, shared by every language. The database
 * guarantees there are no ties and no gaps; `version` changes with every write.
 */
export interface GameCastOrder {
  version: number;
  characters: { game_character_id: string; name: string; position: number }[];
}

export const GameCastOrderSchema = v.object({
  version: v.number(),
  characters: v.array(
    v.object({ game_character_id: v.string(), name: v.string(), position: v.number() }),
  ),
});

const MediaOrderRow = v.nullable(
  v.object({
    id: v.number(),
    game_cast_orders: v.nullable(
      v.object({
        version: v.number(),
        game_cast_order_entries: v.array(
          v.object({
            position: v.number(),
            game_character_id: v.string(),
            game_characters: v.nullable(v.object({ name: v.string() })),
          }),
        ),
      }),
    ),
  }),
);

/** The cast order of a game, or null when the game has no local record. Version 0 = never ordered. */
export async function loadGameCastOrder(
  event: H3Event | undefined,
  igdbGameId: number,
): Promise<GameCastOrder | null> {
  const { data, error } = await useSupabaseAdmin(event)
    .from("media")
    .select(
      "id, game_cast_orders(version, game_cast_order_entries(position, game_character_id, game_characters(name)))",
    )
    .eq("kind", "video_game")
    .eq("content_id", igdbGameId)
    .maybeSingle();
  if (error) throw error;
  const row = v.parse(MediaOrderRow, data);
  if (!row) return null;
  const order = row.game_cast_orders;
  return {
    version: order?.version ?? 0,
    characters: (order?.game_cast_order_entries ?? [])
      .map((entry) => ({
        game_character_id: entry.game_character_id,
        name: entry.game_characters?.name ?? "",
        position: entry.position,
      }))
      .sort((left, right) => left.position - right.position),
  };
}

export interface CastPlacement {
  gameCharacterId: string;
  /** The position to put the character at; null takes it out of the order. */
  rank: number | null;
}

export type CastPlacementResult =
  | { ok: true; order: string[] }
  | { ok: false; reason: "duplicate_character" | "duplicate_rank" }
  | { ok: false; reason: "past_end"; rank: number; highest: number };

/**
 * The order after placing characters, as `place_game_cast_characters` computes it: every placed
 * character is taken out first, then they are inserted by ascending rank, so each ends exactly at
 * its rank and the others keep their relative order. A rank past the end of the list is refused.
 * The same character may appear twice only with the same rank.
 */
export function applyCastPlacements(
  current: readonly string[],
  placements: readonly CastPlacement[],
): CastPlacementResult {
  const byCharacter = new Map<string, number | null>();
  for (const placement of placements) {
    const previous = byCharacter.get(placement.gameCharacterId);
    if (previous !== undefined && previous !== placement.rank) {
      return { ok: false, reason: "duplicate_character" };
    }
    byCharacter.set(placement.gameCharacterId, placement.rank);
  }
  const ranks = [...byCharacter.values()].filter((rank): rank is number => rank !== null);
  if (new Set(ranks).size !== ranks.length) return { ok: false, reason: "duplicate_rank" };

  const order = current.filter((id) => !byCharacter.has(id));
  const inserts = [...byCharacter.entries()]
    .flatMap(([id, rank]) => (rank === null ? [] : [{ id, rank }]))
    .sort((left, right) => left.rank - right.rank);
  for (const { id, rank } of inserts) {
    if (rank > order.length + 1) {
      return { ok: false, reason: "past_end", rank, highest: order.length + 1 };
    }
    order.splice(rank - 1, 0, id);
  }
  return { ok: true, order };
}

/** Human-readable reason for a refused placement. */
export function castPlacementMessage(result: Extract<CastPlacementResult, { ok: false }>): string {
  switch (result.reason) {
    case "duplicate_character":
      return "credits of the same game character were given different cast ranks.";
    case "duplicate_rank":
      return "two characters were given the same cast rank; ranks are unique.";
    case "past_end":
      return `cast_rank ${result.rank} is past the end of the cast order; with the other ranks of this request the highest allowed is ${result.highest}.`;
  }
}

/** The entity tag of a cast order, quoted as HTTP requires. */
export function castOrderEtag(version: number): string {
  return `"cast-order-${version}"`;
}

/** The version in an `If-Match` cast order tag, or null when it is not one. */
export function castOrderVersionFromEtag(etag: string): number | null {
  const match = /^"cast-order-(\d+)"$/.exec(etag.trim());
  return match?.[1] ? Number(match[1]) : null;
}
