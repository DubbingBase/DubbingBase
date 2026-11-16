import { useSupabaseAdmin } from "./db/client";

type AdminClient = ReturnType<typeof useSupabaseAdmin>;
export type CurrentRows = Map<string, Record<string, unknown>>;

/** Audit rows historically use both singular and plural entity type spellings. */
export function normalizeEntityType(entityType: string): "voice_actor" | "studio" | "work" | null {
  if (entityType === "voice_actor" || entityType === "voice_actors") return "voice_actor";
  if (entityType === "studio" || entityType === "studios") return "studio";
  if (entityType === "work") return "work";
  return null;
}

export function currentRowKey(entityType: string, entityId: string | number): string {
  return `${normalizeEntityType(entityType) ?? entityType}:${entityId}`;
}

function toRecord(row: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
}

function numericIds(ids: Iterable<string>): number[] {
  const parsed: number[] = [];
  for (const id of new Set(ids)) {
    if (/^[1-9]\d{0,15}$/.test(id)) parsed.push(Number(id));
  }
  return parsed;
}

/**
 * Loads the current state of the entities that audit rows refer to, in at most three queries,
 * so each entry can be checked against what is stored now (has anything changed since?).
 */
export async function loadCurrentRows(
  supabase: AdminClient,
  rows: ReadonlyArray<{ entity_type: string; entity_id: string }>,
): Promise<CurrentRows> {
  const idsByType = {
    voice_actor: new Set<string>(),
    studio: new Set<string>(),
    work: new Set<string>(),
  };
  for (const row of rows) {
    const type = normalizeEntityType(row.entity_type);
    if (type) idsByType[type].add(row.entity_id);
  }

  const current: CurrentRows = new Map();
  const [voiceActors, studios, works] = await Promise.all([
    idsByType.voice_actor.size
      ? supabase
          .from("voice_actors")
          .select(
            "id, updated_at, firstname, lastname, bio, nationality, date_of_birth, awards, years_active, social_media_links, profile_picture, tmdb_id, wikidata_id",
          )
          .in("id", numericIds(idsByType.voice_actor.values()))
      : null,
    idsByType.studio.size
      ? supabase
          .from("studios")
          .select(
            "id, updated_at, name, description, country, city, website_url, logo_url, social_media_links",
          )
          .in("id", numericIds(idsByType.studio.values()))
      : null,
    idsByType.work.size
      ? supabase
          .from("work")
          .select(
            "id, updated_at, performance, reviewed_status, character_name, voice_actor_id, note",
          )
          .in("id", numericIds(idsByType.work.values()))
      : null,
  ]);
  for (const result of [voiceActors, studios, works]) {
    if (result?.error) throw new Error("Failed to load current entity state");
  }
  for (const row of voiceActors?.data ?? [])
    current.set(currentRowKey("voice_actor", row.id), toRecord(row));
  for (const row of studios?.data ?? [])
    current.set(currentRowKey("studio", row.id), toRecord(row));
  for (const row of works?.data ?? []) current.set(currentRowKey("work", row.id), toRecord(row));
  return current;
}
