/**
 * Narrows an untyped value to a plain object. Arrays and `null` are excluded.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads `key` off an untyped value without a type assertion. Returns `undefined` when the
 * value is not an object.
 */
export function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}
