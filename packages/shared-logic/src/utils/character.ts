export const normalizeCharacterName = (name: string): string => {
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

export const findCharacter = (characterName: string, roleName: string): boolean => {
  if (!characterName || !roleName) return false;
  return characterNamesMatch(splitCharacterNames(characterName), splitCharacterNames(roleName));
};
