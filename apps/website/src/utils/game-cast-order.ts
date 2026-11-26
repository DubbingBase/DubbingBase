/**
 * Helpers for a game's cast order in the project editor. The order is one list per game, shared by
 * every language; the database keeps it at positions 1..n without ties or gaps.
 */

/** Rows with a rank first (by rank), then the unranked rows in their current order. */
export function sortRowsByCastRank<T>(rows: readonly T[], rankOf: (row: T) => number | null): T[] {
  return rows
    .map((row, index) => ({ row, index, rank: rankOf(row) }))
    .sort((left, right) => {
      if (left.rank !== null && right.rank !== null && left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      if (left.rank === null && right.rank !== null) return 1;
      if (left.rank !== null && right.rank === null) return -1;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

/** The list with the item at `from` moved to `to` (clamped); unchanged when the move is a no-op. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (from < 0 || from >= items.length || from === target) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(target, 0, moved);
  return next;
}
