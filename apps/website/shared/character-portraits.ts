export const CHARACTER_PORTRAIT_BATCH_LIMIT = 4;

export interface CharacterRoster {
  tvdbId: number | null;
  characters: Array<{ id: string; name: string; image: string | null }>;
  degraded: boolean;
}

export type CharacterRosterBatch = Record<string, CharacterRoster>;
