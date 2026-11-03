/** Presentation row for the cast workspace; independent of any media type's storage shape. */
export interface CastWorkspaceRow {
  key: string;
  characterName: string;
  characterImage: string | null;
  originalActorName: string;
  originalActorImage: string | null;
  voiceActorName: string;
  voiceActorImage: string | null;
  performance: string;
  highlight: boolean;
}

/** Case-insensitive match against character, original actor and voice actor names. */
export const filterCastRows = (rows: CastWorkspaceRow[], query: string): CastWorkspaceRow[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.characterName, row.originalActorName, row.voiceActorName].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
};

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** Upper bound for rows pre-filled from the original cast, keeping the roster bounded. */
export const ORIGINAL_CAST_SEED_LIMIT = 30;

/**
 * Picks the original cast members to pre-fill when a project has no saved local cast.
 * Members without a character are skipped; TMDB order (billing) is preserved.
 */
export const pickOriginalCastSeed = <T extends { id: number | string; character?: string | null }>(
  cast: T[],
  limit: number = ORIGINAL_CAST_SEED_LIMIT,
): T[] => cast.filter((member) => Boolean(member.character?.trim())).slice(0, limit);
