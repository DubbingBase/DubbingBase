import { isDubbingLanguage, isWikipediaLanguage, type DubbingLanguage } from "@app/shared-logic";

/** pgmq JSON is untrusted. Old `language` fields identify Wikipedia editions only. */
export type QueueMediaType = "movie" | "tv" | "season" | "episode" | "video_game";

export interface ValidQueueBase {
  tmdbId: number;
  mediaType: QueueMediaType;
  wikipediaLanguage?: string;
  dubbingLanguage?: DubbingLanguage;
  requestedBy: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  title?: string;
  wikiId?: string;
  pageTitle?: string;
  pageId?: number;
  revisionId?: number;
  posterPath?: string;
}
export interface ValidCheckPayload extends ValidQueueBase {
  wikipediaLanguage: string;
}
export interface ValidExtractPayload extends ValidCheckPayload {
  dubbingLanguage: DubbingLanguage;
  pageId: number;
  sectionIndexes: number[];
  sectionHeadings?: string[];
}
type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

function property(raw: unknown, key: string): unknown {
  return typeof raw === "object" && raw !== null ? Reflect.get(raw, key) : undefined;
}

export function queueRequester(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    return null;
  }
  return value;
}

/** Omit NULL so PostgreSQL's DEFAULT NULL keeps anonymous work unchanged. */
export function queueRequesterRpcArgs(value: unknown): {
  p_requested_by?: string;
} {
  const requester = queueRequester(value);
  return requester === null ? {} : { p_requested_by: requester };
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
  const value: ValidQueueBase = {
    tmdbId,
    mediaType,
    requestedBy: queueRequester(property(payload, "requested_by")),
  };
  for (const [key, field] of [
    ["title", "title"],
    ["wiki_id", "wikiId"],
    ["page_title", "pageTitle"],
    ["poster_path", "posterPath"],
  ] as const) {
    const raw = property(payload, key);
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
        return { ok: false, reason: `invalid ${key}` };
      }
      value[field] = raw;
    }
  }
  for (const [key, field] of [
    ["page_id", "pageId"],
    ["revision_id", "revisionId"],
  ] as const) {
    const raw = property(payload, key);
    if (raw !== undefined && raw !== null) {
      const number = toInt(raw, 1);
      if (number === null) return { ok: false, reason: `invalid ${key}` };
      value[field] = number;
    }
  }
  const source = property(payload, "wikipedia_language") ?? property(payload, "language");
  if (source !== undefined && source !== null && source !== "") {
    if (!isWikipediaLanguage(source)) {
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

export function validateDiscoveryPayload(payload: unknown): Validated<ValidQueueBase> {
  return validateBase(payload);
}
export function validateCheckPayload(payload: unknown): Validated<ValidCheckPayload> {
  const base = validateBase(payload);
  if (!base.ok) return base;
  if (!base.value.wikipediaLanguage) return { ok: false, reason: "missing wikipedia_language" };
  return {
    ok: true,
    value: { ...base.value, wikipediaLanguage: base.value.wikipediaLanguage },
  };
}
export function validateExtractPayload(payload: unknown): Validated<ValidExtractPayload> {
  const base = validateCheckPayload(payload);
  if (!base.ok) return base;
  if (!base.value.dubbingLanguage) {
    return {
      ok: false,
      reason: "Regional dubbing language is required for extraction",
    };
  }
  const pageId = toInt(property(payload, "page_id"), 1);
  if (pageId === null) return { ok: false, reason: "invalid page_id" };
  const rawSections = property(payload, "section_indexes");
  if (!Array.isArray(rawSections)) return { ok: false, reason: "invalid section_indexes" };
  const sectionIndexes: number[] = rawSections
    .map((raw: unknown) => toInt(raw, 0))
    .filter((n): n is number => n !== null);
  if (sectionIndexes.length === 0) return { ok: false, reason: "no usable section_indexes" };
  const rawHeadings = property(payload, "section_headings");
  const sectionHeadings =
    Array.isArray(rawHeadings) && rawHeadings.every((item) => typeof item === "string")
      ? rawHeadings
      : undefined;
  if (rawHeadings !== undefined && !sectionHeadings) {
    return { ok: false, reason: "invalid section_headings" };
  }
  return {
    ok: true,
    value: {
      ...base.value,
      dubbingLanguage: base.value.dubbingLanguage,
      pageId,
      sectionIndexes,
      ...(sectionHeadings ? { sectionHeadings } : {}),
    },
  };
}
