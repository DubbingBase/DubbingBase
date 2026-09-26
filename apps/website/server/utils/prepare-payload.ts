import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";

type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface PrepareGameInput {
  igdbId: number;
  wikipediaLanguage: string;
  dubbingLanguage: DubbingLanguage;
}

export interface PrepareMediaInput {
  tmdbId: number;
  type: "movie" | "tv" | "season" | "episode";
  seasonNumber: number | null;
  episodeNumber: number | null;
  wikipediaLanguage: string;
  dubbingLanguage: DubbingLanguage;
}

function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function optionalNonNegativeInteger(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function sourceLanguageFrom(value: unknown): string | null {
  // `language` remains a backwards-compatible alias for the Wikipedia source.
  const wikipediaLanguage =
    property(value, "wikipedia_language") ?? property(value, "language");
  return typeof wikipediaLanguage === "string" &&
    /^[a-z][a-z0-9-]*$/.test(wikipediaLanguage)
    ? wikipediaLanguage
    : null;
}

export function validatePrepareGamePayload(
  payload: unknown,
): Validated<PrepareGameInput> {
  const igdbId = positiveInteger(property(payload, "igdbId"));
  if (igdbId === null) return { ok: false, reason: "igdbId must be a number" };
  const wikipediaLanguage = sourceLanguageFrom(payload);
  if (!wikipediaLanguage) {
    return {
      ok: false,
      reason: "A valid Wikipedia source language is required",
    };
  }
  const dubbingLanguage = property(payload, "dubbing_language");
  if (!isDubbingLanguage(dubbingLanguage)) {
    return {
      ok: false,
      reason: "A registered regional dubbing language is required",
    };
  }
  return {
    ok: true,
    value: { igdbId, wikipediaLanguage, dubbingLanguage },
  };
}

export async function prepareGameFromPayload<T>(
  payload: unknown,
  prepare: (input: PrepareGameInput) => Promise<T>,
): Promise<Validated<T>> {
  const valid = validatePrepareGamePayload(payload);
  if (!valid.ok) return valid;
  return { ok: true, value: await prepare(valid.value) };
}

export function validatePrepareMediaPayload(
  payload: unknown,
): Validated<PrepareMediaInput> {
  const tmdbId = positiveInteger(property(payload, "tmdbId"));
  if (tmdbId === null) return { ok: false, reason: "tmdbId must be a number" };
  const type = property(payload, "type");
  if (
    type !== "movie" &&
    type !== "tv" &&
    type !== "season" &&
    type !== "episode"
  ) {
    return { ok: false, reason: "Invalid media type" };
  }
  const wikipediaLanguage = sourceLanguageFrom(payload);
  if (!wikipediaLanguage) {
    return {
      ok: false,
      reason: "A valid Wikipedia source language is required",
    };
  }
  const dubbingLanguage = property(payload, "dubbing_language");
  if (!isDubbingLanguage(dubbingLanguage)) {
    return {
      ok: false,
      reason: "A registered regional dubbing language is required",
    };
  }
  const seasonNumber = optionalNonNegativeInteger(
    property(payload, "seasonNumber"),
  );
  const episodeNumber = optionalNonNegativeInteger(
    property(payload, "episodeNumber"),
  );
  if (seasonNumber === null || episodeNumber === null) {
    return { ok: false, reason: "Invalid season or episode number" };
  }
  return {
    ok: true,
    value: {
      tmdbId,
      type,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
      wikipediaLanguage,
      dubbingLanguage,
    },
  };
}
