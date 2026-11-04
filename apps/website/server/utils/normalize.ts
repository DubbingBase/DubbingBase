export function normalizeString(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NON_EXPLOITABLE_NAMES = new Set([
  "n/a",
  "n a",
  "na",
  "?",
  "unknown",
  "inconnu",
  "none",
  "aucun",
  "-",
]);

/** True when a name is a real exploitable person name (not N/A, ?, unknown, dash-only, ...). Never modifies the input. */
export function isExploitableVoiceActorName(input: string | null | undefined): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (NON_EXPLOITABLE_NAMES.has(trimmed.toLowerCase())) return false;
  const norm = normalizeString(trimmed);
  if (!norm) return false;
  return !NON_EXPLOITABLE_NAMES.has(norm);
}
