/**
 * Normalizes a string for search and scoring by removing all non-alphanumeric
 * characters (except spaces) and converting to lowercase.
 * This makes search highly tolerant to punctuation differences.
 *
 * Example:
 * "One Piece: Pirate Warriors 4 - One Piece Film: Red Pack"
 * -> "one piece pirate warriors 4 one piece film red pack"
 */
export function normalizeString(input: string | null | undefined): string {
  if (!input) return "";

  return (
    input
      .toLowerCase()
      // Replace anything that is not a letter, number, or space with a space
      // We use \p{L} and \p{N} to support unicode letters and numbers
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      // Collapse multiple spaces into a single space
      .replace(/\s+/g, " ")
      .trim()
  );
}
