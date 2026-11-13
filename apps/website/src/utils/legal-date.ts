/**
 * Locale-independent "YYYY-MM-DD" (UTC) for legal pages. `toLocaleDateString()`
 * depends on the runtime locale, which differs between the Worker and the
 * visitor's browser and causes a hydration text mismatch.
 */
export function formatLegalDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
