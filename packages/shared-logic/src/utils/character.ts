export const normalizeCharacterName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Remove text in parentheses (...)
    .replace(/["'][^"']*["']/g, "") // Remove text in quotes '...' or "..."
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
};

type NormalizedCharacterName = {
  value: string;
  words: string[];
};

function splitCharacterNames(name: string): NormalizedCharacterName[] {
  return name
    .split("/")
    .map(normalizeCharacterName)
    .filter(Boolean)
    .map((value) => ({ value, words: value.split(" ") }));
}

function characterNamesMatch(
  charNames: readonly NormalizedCharacterName[],
  roleNames: readonly NormalizedCharacterName[],
): boolean {
  for (const charName of charNames) {
    for (const roleName of roleNames) {
      // Fast exact match
      if (charName.value === roleName.value) {
        return true;
      }

      // Word-boundary partial matching (to prevent "Sam" matching "Samantha")
      // If all words in either name exist in the other, they match.
      if (
        charName.words.every((word) => roleName.words.includes(word)) ||
        roleName.words.every((word) => charName.words.includes(word))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function createCharacterMatcher(roleName: string): (characterName: string) => boolean {
  const normalizedRoleNames = splitCharacterNames(roleName);
  return (characterName) =>
    characterNamesMatch(splitCharacterNames(characterName), normalizedRoleNames);
}

export const findCharacter = (
  characterName: string | null | undefined,
  roleName: string | null | undefined,
): boolean => {
  if (!characterName || !roleName) return false;
  return characterNamesMatch(splitCharacterNames(characterName), splitCharacterNames(roleName));
};

/**
 * The single TVDB role of this production matching one of the candidate names
 * (tried in order, existing role-name matcher). Several different matching
 * roles are ambiguous and yield nothing. The image is optional: a role without
 * one still identifies the character page.
 */
export function selectTvdbCharacter(
  names: readonly string[],
  characters: ReadonlyArray<{ id: number | string; name?: string | null; image?: string | null }>,
): { id: string; image: string | null } | null {
  for (const name of names) {
    if (!name.trim()) continue;
    const matches = createCharacterMatcher(name);
    const candidates = characters.filter((character) => character.name && matches(character.name));
    const [match] = candidates;
    if (!match) continue;
    if (new Set(candidates.map((candidate) => String(candidate.id))).size !== 1) return null;
    const image = candidates.find((candidate) => candidate.image)?.image ?? null;
    return { id: String(match.id), image: image && /^https?:\/\//.test(image) ? image : null };
  }
  return null;
}
