/**
 * Strict validation for media queue payloads (pgmq JSON is untrusted input).
 * Broken elements are archived with a precise reason instead of dying deep
 * in the pipeline. Numeric fields are coerced (pgmq may deliver strings).
 */

export type QueueMediaType =
  "movie" | "tv" | "season" | "episode" | "video_game";

const MEDIA_TYPES: readonly string[] = [
  "movie",
  "tv",
  "season",
  "episode",
  "video_game",
];

export interface ValidQueueBase {
  tmdbId: number;
  mediaType: QueueMediaType;
  language: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface ValidExtractPayload extends ValidQueueBase {
  pageId: number;
  sectionIndexes: number[];
}

type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

function toPositiveInt(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toNonNegativeInt(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function validateBase(payload: any): Validated<ValidQueueBase> {
  const mediaType = payload?.media_type;
  if (!MEDIA_TYPES.includes(mediaType)) {
    return {
      ok: false,
      reason: `unknown media_type ${JSON.stringify(mediaType)}`,
    };
  }
  const tmdbId = toPositiveInt(payload?.tmdb_id);
  if (tmdbId === null) {
    return {
      ok: false,
      reason: `invalid tmdb_id ${JSON.stringify(payload?.tmdb_id)}`,
    };
  }
  const rawLang = payload?.language;
  const language =
    rawLang === undefined || rawLang === null || rawLang === ""
      ? "fr"
      : String(rawLang).trim() || "fr";

  const value: ValidQueueBase = { tmdbId, mediaType, language };

  if (payload?.season_number !== undefined && payload?.season_number !== null) {
    const seasonNumber = toNonNegativeInt(payload.season_number);
    if (seasonNumber === null) {
      return {
        ok: false,
        reason: `invalid season_number ${JSON.stringify(payload.season_number)}`,
      };
    }
    value.seasonNumber = seasonNumber;
  }
  if (
    payload?.episode_number !== undefined &&
    payload?.episode_number !== null
  ) {
    const episodeNumber = toNonNegativeInt(payload.episode_number);
    if (episodeNumber === null) {
      return {
        ok: false,
        reason: `invalid episode_number ${JSON.stringify(payload.episode_number)}`,
      };
    }
    value.episodeNumber = episodeNumber;
  }
  return { ok: true, value };
}

export function validateCheckPayload(payload: any): Validated<ValidQueueBase> {
  return validateBase(payload);
}

export function validateDiscoveryPayload(
  payload: any,
): Validated<ValidQueueBase> {
  return validateBase(payload);
}

export function validateExtractPayload(
  payload: any,
): Validated<ValidExtractPayload> {
  const base = validateBase(payload);
  if (!base.ok) return base;
  const pageId = toPositiveInt(payload?.page_id);
  if (pageId === null) {
    return {
      ok: false,
      reason: `invalid page_id ${JSON.stringify(payload?.page_id)}`,
    };
  }
  const rawSections = payload?.section_indexes;
  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return {
      ok: false,
      reason: `invalid section_indexes ${JSON.stringify(rawSections)}`,
    };
  }
  const sectionIndexes = rawSections
    .map((s) => toNonNegativeInt(s))
    .filter((n): n is number => n !== null);
  if (sectionIndexes.length === 0) {
    return {
      ok: false,
      reason: `no usable section_indexes in ${JSON.stringify(rawSections)}`,
    };
  }
  return { ok: true, value: { ...base.value, pageId, sectionIndexes } };
}
