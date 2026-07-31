export const normalizeCharacterName = (name: string): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Remove text in parentheses (...)
    .replace(/["'][^"']*["']/g, "") // Remove text in quotes '...' or "..."
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
};

export const findCharacter = (
  characterName: string,
  roleName: string,
): boolean => {
  if (!characterName || !roleName) return false;

  const charNames = characterName
    .split("/")
    .map(normalizeCharacterName)
    .filter(Boolean);
  const roleNames = roleName
    .split("/")
    .map(normalizeCharacterName)
    .filter(Boolean);

  for (const cName of charNames) {
    for (const rName of roleNames) {
      // Fast exact match
      if (cName === rName) {
        return true;
      }

      // Word-boundary partial matching (to prevent "Sam" matching "Samantha")
      // We check if the shorter name is a full word inside the longer name
      if (cName.length > 0 && rName.length > 0) {
        const cWords = cName.split(" ");
        const rWords = rName.split(" ");

        // If all words in cName exist in rName, or vice-versa
        if (
          cWords.every((w) => rWords.includes(w)) ||
          rWords.every((w) => cWords.includes(w))
        ) {
          return true;
        }
      }
    }
  }

  return false;
};
