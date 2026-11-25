import { isMediaKind, isRecord, type MediaKind } from "@app/shared-logic";
import { createCacheNamespace } from "../cache";
import { useCache } from "../index";
import { useSupabaseAdmin } from "./client";

/**
 * Which provider ids does DubbingBase have data for?
 *
 * Public pages are requested by provider id (TMDB person/movie/tv, IGDB, ...), and crawlers walk those ids at
 * random. Almost every crawled id has no row here, yet each one used to cost a (logged) Supabase request that
 * returned nothing. A compact snapshot of the ids that DO have data lets the page queries answer "no data" for
 * the rest without a database call. The snapshot is built by one RPC, shared across isolates through KV for a
 * couple of minutes, and kept in isolate memory for a few seconds.
 *
 * Every helper here fails open: if the snapshot cannot be loaded or looks wrong, the caller runs its normal
 * query, so an outage of this cache can never hide real data.
 */

const SNAPSHOT_KEY = "known-content-ids-v1";
/** Lifetime of the shared KV copy. Writes through the website's own routes invalidate it explicitly. */
const SNAPSHOT_TTL_SECONDS = 120;
/** Lifetime of the per-isolate copy, so isolates pick up an invalidation quickly. */
const MEMORY_TTL_MS = 30_000;
/** After a failed load, run normal queries for this long before trying again. */
const FAILURE_RETRY_MS = 15_000;

/** JSON shape stored in KV: arrays, not sets, so it survives `JSON.stringify`. */
interface KnownContentIdsSnapshot {
  media: Record<string, number[]>;
  actors: number[];
}

interface KnownContentIds {
  media: ReadonlyMap<MediaKind, ReadonlySet<number>>;
  actors: ReadonlySet<number>;
}

function readIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isSafeInteger(item)) return null;
    ids.push(item);
  }
  return ids;
}

/**
 * Validates untrusted JSON (RPC result or KV content). A partly valid snapshot is rejected as a whole, because
 * a set missing ids would wrongly hide real data. An entirely empty snapshot is rejected too: an empty database
 * is indistinguishable from a broken one, and the normal queries are cheap there.
 */
function parseSnapshot(value: unknown): KnownContentIdsSnapshot | null {
  if (!isRecord(value) || !isRecord(value.media)) return null;
  const actors = readIds(value.actors);
  if (!actors) return null;

  const media: Record<string, number[]> = {};
  let mediaCount = 0;
  for (const [kind, rawIds] of Object.entries(value.media)) {
    const ids = readIds(rawIds);
    if (!ids) return null;
    media[kind] = ids;
    mediaCount += ids.length;
  }

  if (actors.length === 0 && mediaCount === 0) return null;
  return { media, actors };
}

function toKnownContentIds(snapshot: KnownContentIdsSnapshot): KnownContentIds {
  const media = new Map<MediaKind, ReadonlySet<number>>();
  for (const [kind, ids] of Object.entries(snapshot.media)) {
    if (isMediaKind(kind)) media.set(kind, new Set(ids));
  }
  return { media, actors: new Set(snapshot.actors) };
}

async function fetchSnapshot(): Promise<KnownContentIdsSnapshot> {
  const { data, error } = await useSupabaseAdmin().rpc("get_known_content_ids");
  if (error) throw error;
  const snapshot = parseSnapshot(data);
  if (!snapshot) throw new Error("Known content ids snapshot is empty or malformed");
  return snapshot;
}

// Replaced on every invalidation: the in-flight de-duplication inside `getOrFetch` is keyed by namespace, so a
// load that starts after a write must not join a fetch that started before it.
let snapshotNamespace = createCacheNamespace<KnownContentIdsSnapshot>();
let memory: { value: KnownContentIds | null; expiresAt: number } | null = null;
let loading: Promise<KnownContentIds | null> | null = null;
/** Bumped by every invalidation, so a load can tell that its result may predate a write. */
let generation = 0;

async function deleteSharedSnapshot(): Promise<void> {
  try {
    await useCache().del(SNAPSHOT_KEY);
  } catch (error) {
    console.warn("[KnownContentIds] Could not clear the shared snapshot.", error);
  }
}

/** Never rejects: any failure means "unavailable", and callers then query the database. */
async function loadSnapshot(startedGeneration: number): Promise<KnownContentIds | null> {
  try {
    const raw = await useCache().getOrFetch(snapshotNamespace, SNAPSHOT_KEY, fetchSnapshot, {
      cachePolicy: "persistent",
      ttl: SNAPSHOT_TTL_SECONDS,
    });
    // KV content is plain JSON that nothing type-checks, so validate it again.
    const snapshot = parseSnapshot(raw);
    const value = snapshot ? toKnownContentIds(snapshot) : null;

    if (generation !== startedGeneration) {
      // A write invalidated the snapshot while this load ran, so the result may predate that write. Do not
      // keep it, remove it from KV where this load may just have stored it, and let callers query the database.
      await deleteSharedSnapshot();
      return null;
    }

    memory = { value, expiresAt: Date.now() + (value ? MEMORY_TTL_MS : FAILURE_RETRY_MS) };
    return value;
  } catch (error) {
    console.warn("[KnownContentIds] Snapshot unavailable; querying the database instead.", error);
    if (generation === startedGeneration) {
      memory = { value: null, expiresAt: Date.now() + FAILURE_RETRY_MS };
    }
    return null;
  }
}

/** The known ids, or null when they are unavailable (callers must then query the database). */
async function loadKnownContentIds(): Promise<KnownContentIds | null> {
  if (memory && memory.expiresAt > Date.now()) return memory.value;
  if (loading) return await loading;

  const promise = loadSnapshot(generation);
  loading = promise;
  // Only clear our own entry: an invalidation may already have replaced it with a newer load.
  void promise.finally(() => {
    if (loading === promise) loading = null;
  });
  return await promise;
}

/** True when `media` has a row for this provider reference, or when that cannot be told. */
export async function isKnownMedia(kind: MediaKind, contentId: number): Promise<boolean> {
  const known = await loadKnownContentIds();
  if (!known) return true;
  return known.media.get(kind)?.has(contentId) ?? false;
}

/** True when at least one `work` row has this actor id, or when that cannot be told. */
export async function isKnownActor(actorId: number): Promise<boolean> {
  const known = await loadKnownContentIds();
  if (!known) return true;
  return known.actors.has(actorId);
}

/**
 * Forget the snapshot, locally and in KV. Call it after writes that can add a media or a work, so the next
 * read rebuilds it instead of reporting the new id as unknown.
 *
 * Best effort and never throws: callers have already committed their write, so a cache failure must not turn
 * a successful save into an error. The snapshot expires on its own within a couple of minutes anyway.
 */
export async function invalidateKnownContentIds(): Promise<void> {
  generation += 1;
  memory = null;
  loading = null;
  snapshotNamespace = createCacheNamespace<KnownContentIdsSnapshot>();
  await deleteSharedSnapshot();
}
