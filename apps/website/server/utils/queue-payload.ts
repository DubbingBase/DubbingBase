import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";

/** pgmq JSON is untrusted. Old `language` fields identify Wikipedia editions only. */
export type QueueMediaType =
  "movie" | "tv" | "season" | "episode" | "video_game";

export interface ValidQueueBase {
  tmdbId: number;
  mediaType: QueueMediaType;
  wikipediaLanguage?: string;
  dubbingLanguage?: DubbingLanguage;
  seasonNumber?: number;
  episodeNumber?: number;
}
export interface ValidCheckPayload extends ValidQueueBase {
  wikipediaLanguage: string;
}
export interface ValidExtractPayload extends ValidCheckPayload {
  dubbingLanguage: DubbingLanguage;
  pageId: number;
  sectionIndexes: number[];
}
type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

function property(raw: unknown, key: string): unknown {
  return typeof raw === "object" && raw !== null
    ? Reflect.get(raw, key)
    : undefined;
}
function toInt(raw: unknown, minimum: number): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= minimum ? value : null;
}

function validateBase(payload: unknown): Validated<ValidQueueBase> {
  const mediaType = property(payload, "media_type");
  if (
    mediaType !== "movie" &&
    mediaType !== "tv" &&
    mediaType !== "season" &&
    mediaType !== "episode" &&
    mediaType !== "video_game"
  ) {
    return {
      ok: false,
      reason: `unknown media_type ${JSON.stringify(mediaType)}`,
    };
  }
  const tmdbId = toInt(property(payload, "tmdb_id"), 1);
  if (tmdbId === null) return { ok: false, reason: "invalid tmdb_id" };
  const value: ValidQueueBase = { tmdbId, mediaType };
  const source =
    property(payload, "wikipedia_language") ?? property(payload, "language");
  if (source !== undefined && source !== null && source !== "") {
    if (typeof source !== "string" || !/^[a-z][a-z0-9-]*$/.test(source)) {
      return { ok: false, reason: "invalid wikipedia_language" };
    }
    value.wikipediaLanguage = source;
  }
  const target = property(payload, "dubbing_language");
  if (target !== undefined && target !== null) {
    if (!isDubbingLanguage(target))
      return { ok: false, reason: "invalid regional dubbing_language" };
    value.dubbingLanguage = target;
  }
  for (const [key, field] of [
    ["season_number", "seasonNumber"],
    ["episode_number", "episodeNumber"],
  ]) {
    if (!key || !field) continue;
    const raw = property(payload, key);
    if (raw === undefined || raw === null) continue;
    const number = toInt(raw, 0);
    if (number === null) return { ok: false, reason: `invalid ${key}` };
    if (field === "seasonNumber") value.seasonNumber = number;
    else value.episodeNumber = number;
  }
  return { ok: true, value };
}

export function validateDiscoveryPayload(
  payload: unknown,
): Validated<ValidQueueBase> {
  return validateBase(payload);
}
export function validateCheckPayload(
  payload: unknown,
): Validated<ValidCheckPayload> {
  const base = validateBase(payload);
  if (!base.ok) return base;
  if (!base.value.wikipediaLanguage)
    return { ok: false, reason: "missing wikipedia_language" };
  return {
    ok: true,
    value: { ...base.value, wikipediaLanguage: base.value.wikipediaLanguage },
  };
}
export function validateExtractPayload(
  payload: unknown,
): Validated<ValidExtractPayload> {
  const base = validateCheckPayload(payload);
  if (!base.ok) return base;
  if (!base.value.dubbingLanguage) {
    return { ok: false, reason: "Regional dubbing language requires review" };
  }
  const pageId = toInt(property(payload, "page_id"), 1);
  if (pageId === null) return { ok: false, reason: "invalid page_id" };
  const rawSections = property(payload, "section_indexes");
  if (!Array.isArray(rawSections))
    return { ok: false, reason: "invalid section_indexes" };
  const sectionIndexes: number[] = rawSections
    .map((raw: unknown) => toInt(raw, 0))
    .filter((n): n is number => n !== null);
  if (sectionIndexes.length === 0)
    return { ok: false, reason: "no usable section_indexes" };
  return {
    ok: true,
    value: {
      ...base.value,
      dubbingLanguage: base.value.dubbingLanguage,
      pageId,
      sectionIndexes,
    },
  };
}
