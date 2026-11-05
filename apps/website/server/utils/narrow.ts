/**
 * Narrows an untyped value (a query parameter, a runtime-config entry, ...) to a string.
 * Returns `undefined` for anything that is not a string, so callers can fall back explicitly
 * instead of casting with `as string`.
 */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
