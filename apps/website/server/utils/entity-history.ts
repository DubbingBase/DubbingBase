import type { Json } from "@app/supabase";
import { isJson, isRecord } from "@app/shared-logic";

export type HistoryEntityType = "voice_actor" | "studio" | "work";

export type HistoryChange = {
  /** Field name; social links are expanded per platform as `social_media_links.<platform>`. */
  field: string;
  /** `high` fields (names, pictures, external ids, credit role/voice actor, review status) are highlighted. */
  importance: "high" | "normal";
  type: "text" | "image" | "link" | "status";
  /** Display strings (objects are JSON-encoded); null means empty. Sent as strings so the API type stays flat. */
  before: string | null;
  after: string | null;
  /** Deep links: an image URL for `image` changes, an external or site URL for `link` values. */
  beforeHref: string | null;
  afterHref: string | null;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  action: string;
  contributor: string;
  kind: "created" | "edited" | "deleted" | "verification";
  /** True when at least one change is `high` importance. */
  important: boolean;
  /** What was edited: the entity profile itself, or one cast credit attached to it. */
  target: "profile" | "cast_credit";
  /** Cast credit label (character name) when `target` is `cast_credit`. */
  label: string | null;
  /** Site path to the credited media for cast credits (for example `/movie/123`), else null. */
  href: string | null;
  /** True once an admin has reverted this entry. */
  reverted: boolean;
  /** True only for admin requesters when the entry can still be safely reverted. */
  revertable: boolean;
  revertBlockedReason: "changed_since" | "unsupported" | null;
  changes: HistoryChange[];
};

export type HistoryResponse = {
  /** True when the requester is an admin and may use the revert button. */
  canRevert: boolean;
  entries: HistoryEntry[];
};

// Only these fields are shown publicly. Audit snapshots hold whole rows, including internal
// columns (created_by, updated_by, status workflow), which must never leave the server.
type FieldKind = "profile" | "studio" | "work";
type FieldMeta = { importance: "high" | "normal"; type: HistoryChange["type"] };

const fieldMeta: Record<FieldKind, Record<string, FieldMeta>> = {
  profile: {
    firstname: { importance: "high", type: "text" },
    lastname: { importance: "high", type: "text" },
    bio: { importance: "normal", type: "text" },
    nationality: { importance: "normal", type: "text" },
    date_of_birth: { importance: "normal", type: "text" },
    awards: { importance: "normal", type: "text" },
    years_active: { importance: "normal", type: "text" },
    social_media_links: { importance: "normal", type: "link" },
    profile_picture: { importance: "high", type: "image" },
    tmdb_id: { importance: "high", type: "link" },
    wikidata_id: { importance: "high", type: "link" },
  },
  studio: {
    name: { importance: "high", type: "text" },
    description: { importance: "normal", type: "text" },
    country: { importance: "normal", type: "text" },
    city: { importance: "normal", type: "text" },
    website_url: { importance: "normal", type: "link" },
    logo_url: { importance: "high", type: "image" },
    social_media_links: { importance: "normal", type: "link" },
  },
  work: {
    character_name: { importance: "high", type: "text" },
    performance: { importance: "normal", type: "text" },
    voice_actor_id: { importance: "high", type: "link" },
    reviewed_status: { importance: "high", type: "status" },
    note: { importance: "normal", type: "text" },
  },
};

export function isHistoryEntityType(value: unknown): value is HistoryEntityType {
  return value === "voice_actor" || value === "studio" || value === "work";
}

function readField(value: unknown, field: string): Json {
  if (!isRecord(value)) return null;
  const entry = value[field];
  return isJson(entry) ? entry : null;
}

function sameJson(left: Json, right: Json): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** How a stored value reads in the history view; null means empty. */
export function displayValue(value: Json): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export type ChangedField = { field: string; before: Json; after: Json };

/** Allowlisted fields whose value differs between two audit snapshots; a missing snapshot reads as null. */
export function changedFields(kind: FieldKind, previous: unknown, next: unknown): ChangedField[] {
  const changes: ChangedField[] = [];
  for (const field of Object.keys(fieldMeta[kind])) {
    const before = readField(previous, field);
    const after = readField(next, field);
    if (!sameJson(before, after)) changes.push({ field, before, after });
  }
  return changes;
}

/** Only http(s) URLs may become links; credentials and other schemes are dropped. */
export function safeHttpUrl(value: Json): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function valueHref(field: string, value: Json): string | null {
  if (value === null) return null;
  if (field === "tmdb_id") {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? `https://www.themoviedb.org/person/${value}`
      : null;
  }
  if (field === "wikidata_id") {
    return typeof value === "string" && /^Q[1-9]\d*$/.test(value)
      ? `https://www.wikidata.org/wiki/${value}`
      : null;
  }
  if (field === "voice_actor_id") {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? `/voice-actor/${value}`
      : null;
  }
  if (field === "website_url") return safeHttpUrl(value);
  return null;
}

/** Social links are shown one platform at a time so each URL is its own change and link. */
function expandSocialLinks(before: Json, after: Json): ChangedField[] {
  const beforeLinks = isRecord(before) ? before : {};
  const afterLinks = isRecord(after) ? after : {};
  const platforms = [...new Set([...Object.keys(beforeLinks), ...Object.keys(afterLinks)])].sort();
  const changes: ChangedField[] = [];
  for (const platform of platforms) {
    const previous = isJson(beforeLinks[platform]) ? beforeLinks[platform] : null;
    const next = isJson(afterLinks[platform]) ? afterLinks[platform] : null;
    if (!sameJson(previous, next)) {
      changes.push({ field: `social_media_links.${platform}`, before: previous, after: next });
    }
  }
  return changes;
}

/** Decorated changes for display: importance, type and deep links. */
export function diffSnapshots(kind: FieldKind, previous: unknown, next: unknown): HistoryChange[] {
  const decorated: HistoryChange[] = [];
  for (const change of changedFields(kind, previous, next)) {
    const meta = fieldMeta[kind][change.field];
    if (!meta) continue;
    const parts =
      change.field === "social_media_links"
        ? expandSocialLinks(change.before, change.after)
        : [change];
    for (const part of parts) {
      const isSocial = part.field.startsWith("social_media_links.");
      decorated.push({
        field: part.field,
        importance: meta.importance,
        type: meta.type,
        before: displayValue(part.before),
        after: displayValue(part.after),
        beforeHref: isSocial ? safeHttpUrl(part.before) : valueHref(part.field, part.before),
        afterHref: isSocial ? safeHttpUrl(part.after) : valueHref(part.field, part.after),
      });
    }
  }
  return decorated;
}

export type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  user_name: string;
  previous_value: unknown;
  new_value: unknown;
  reverted_at?: string | null;
};

export type HistoryEntryContext = {
  /** Site path of the media a cast credit belongs to, from its dubbing project id. */
  mediaHref?: (dubbingProjectId: number) => string | null;
};

function entryKind(
  isWork: boolean,
  previous: unknown,
  next: unknown,
  changes: HistoryChange[],
): HistoryEntry["kind"] {
  if (!isRecord(previous)) return "created";
  if (!isRecord(next)) return "deleted";
  if (isWork && changes.every((change) => change.field === "reviewed_status"))
    return "verification";
  return "edited";
}

/** Turns an audit row into a public history entry, or null when it has no visible change. */
export function toHistoryEntry(
  row: AuditRow,
  entityType: HistoryEntityType,
  context: HistoryEntryContext = {},
): HistoryEntry | null {
  const isWork = row.entity_type === "work";
  const kind = isWork ? "work" : entityType === "studio" ? "studio" : "profile";
  const changes = diffSnapshots(kind, row.previous_value, row.new_value);
  if (changes.length === 0) return null;

  let label: string | null = null;
  let href: string | null = null;
  if (isWork) {
    const snapshot = isRecord(row.new_value) ? row.new_value : row.previous_value;
    const name = readField(snapshot, "character_name");
    label = typeof name === "string" ? name : null;
    const projectId = readField(snapshot, "dubbing_project_id");
    href = typeof projectId === "number" ? (context.mediaHref?.(projectId) ?? null) : null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    contributor: row.user_name,
    kind: entryKind(isWork, row.previous_value, row.new_value, changes),
    important: changes.some((change) => change.importance === "high"),
    target: isWork ? "cast_credit" : "profile",
    label,
    href,
    reverted: row.reverted_at !== null && row.reverted_at !== undefined,
    revertable: false,
    revertBlockedReason: null,
    changes,
  };
}

const mediaPrefixes: Record<string, string> = {
  movie: "/movie",
  tv: "/show",
  video_game: "/game",
  audiobook: "/audiobook",
  podcast: "/podcast",
  advertisement: "/advertisement",
  toy: "/toy",
};

/** Site path for a dubbing project's media, or null for an unknown content type. */
export function mediaPath(contentType: string, contentId: number): string | null {
  const prefix = mediaPrefixes[contentType];
  return prefix ? `${prefix}/${contentId}` : null;
}
