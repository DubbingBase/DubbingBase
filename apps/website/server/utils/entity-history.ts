import type { Json } from "@app/supabase";
import { isJson, isRecord } from "@app/shared-logic";

export type HistoryEntityType = "voice_actor" | "studio" | "work";

export type HistoryChange = {
  field: string;
  before: Json;
  after: Json;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  action: string;
  contributor: string;
  /** What was edited: the entity profile itself, or one cast credit attached to it. */
  target: "profile" | "cast_credit";
  /** Cast credit label (character name) when `target` is `cast_credit`. */
  label: string | null;
  changes: HistoryChange[];
};

// Only these fields are shown publicly. Audit snapshots hold whole rows, including internal
// columns (created_by, updated_by, status workflow), which must never leave the server.
const fieldAllowlist: Record<"profile" | "studio" | "work", readonly string[]> = {
  profile: [
    "firstname",
    "lastname",
    "bio",
    "nationality",
    "date_of_birth",
    "awards",
    "years_active",
    "social_media_links",
    "profile_picture",
    "tmdb_id",
    "wikidata_id",
  ],
  studio: [
    "name",
    "description",
    "country",
    "city",
    "website_url",
    "logo_url",
    "social_media_links",
  ],
  work: ["character_name", "performance", "voice_actor_id", "reviewed_status", "note"],
};

export function isHistoryEntityType(value: unknown): value is HistoryEntityType {
  return value === "voice_actor" || value === "studio" || value === "work";
}

function readField(value: unknown, field: string): Json {
  if (!isRecord(value)) return null;
  const entry = value[field];
  return isJson(entry) ? entry : null;
}

/** Fields whose value differs between two audit snapshots; a missing snapshot reads as null. */
export function diffSnapshots(
  kind: keyof typeof fieldAllowlist,
  previous: unknown,
  next: unknown,
): HistoryChange[] {
  const changes: HistoryChange[] = [];
  for (const field of fieldAllowlist[kind]) {
    const before = readField(previous, field);
    const after = readField(next, field);
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field, before, after });
  }
  return changes;
}

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  user_name: string;
  previous_value: unknown;
  new_value: unknown;
};

/** Turns an audit row into a public history entry, or null when it has no visible change. */
export function toHistoryEntry(row: AuditRow, entityType: HistoryEntityType): HistoryEntry | null {
  const isWork = row.entity_type === "work";
  const kind = isWork ? "work" : entityType === "studio" ? "studio" : "profile";
  const changes = diffSnapshots(kind, row.previous_value, row.new_value);
  if (changes.length === 0) return null;
  const label = isWork
    ? (() => {
        const name =
          readField(row.new_value, "character_name") ??
          readField(row.previous_value, "character_name");
        return typeof name === "string" ? name : null;
      })()
    : null;
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    contributor: row.user_name,
    target: isWork ? "cast_credit" : "profile",
    label,
    changes,
  };
}
