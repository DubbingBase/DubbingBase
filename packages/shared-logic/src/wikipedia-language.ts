const WIKIPEDIA_LANGUAGE_PATTERN = /^[a-z][a-z0-9-]*$/;

export function isWikipediaLanguage(value: unknown): value is string {
  return typeof value === "string" && value !== "simple" && WIKIPEDIA_LANGUAGE_PATTERN.test(value);
}
