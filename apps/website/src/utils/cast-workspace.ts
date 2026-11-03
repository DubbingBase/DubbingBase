/** Presentation row for the cast workspace; independent of any media type's storage shape. */
export interface CastWorkspaceRow {
  key: string;
  characterName: string;
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
