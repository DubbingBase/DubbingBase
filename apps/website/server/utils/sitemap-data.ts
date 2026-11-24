import type { H3Event } from "h3";
import { useSupabaseAdmin } from "./db/client";
import { SITEMAP_CHUNK_SIZE, SITEMAP_ENTITIES, chunkCount, type SitemapRecord } from "./sitemap";

type EntityName = (typeof SITEMAP_ENTITIES)[number]["name"];

const MEDIA_CONTENT_TYPES = {
  movies: { contentType: "movie", pathPrefix: "/movie" },
  shows: { contentType: "tv", pathPrefix: "/show" },
  games: { contentType: "video_game", pathPrefix: "/game" },
} as const;

/** Supabase/PostgREST caps a response at `max_rows` (1000 by default), so larger ranges are paged. */
const SUPABASE_PAGE_SIZE = 1000;

async function fetchPaged<Row>(
  fetchRange: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: Error | null }>,
  from: number,
  to: number,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = from; start <= to; start += SUPABASE_PAGE_SIZE) {
    const end = Math.min(start + SUPABASE_PAGE_SIZE - 1, to);
    const { data, error } = await fetchRange(start, end);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < end - start + 1) break;
  }
  return rows;
}

function latest(current: string | null | undefined, next: string | null | undefined) {
  if (!next) return current ?? null;
  if (!current) return next;
  return next > current ? next : current;
}

/** Row count for an entity; for media this counts the media that have at least one dubbing project. */
async function countRows(event: H3Event, name: EntityName): Promise<number> {
  const supabase = useSupabaseAdmin(event);
  const query =
    name === "voice-actors"
      ? supabase.from("voice_actors").select("id", { count: "exact", head: true })
      : name === "studios"
        ? supabase.from("studios").select("id", { count: "exact", head: true })
        : supabase
            .from("media")
            .select("id, dubbing_projects!inner(id)", { count: "exact", head: true })
            .eq("kind", MEDIA_CONTENT_TYPES[name].contentType);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function listSitemapChunks(
  event: H3Event,
): Promise<{ name: EntityName; chunks: number }[]> {
  const counts = await Promise.all(
    SITEMAP_ENTITIES.map(async ({ name }) => ({
      name,
      chunks: chunkCount(await countRows(event, name)),
    })),
  );
  return counts.filter(({ chunks }) => chunks > 0);
}

/**
 * Fetches one chunk using a stable, indexed ordering and a range query, selecting only the
 * identifier and modification time.
 */
export async function loadSitemapChunk(
  event: H3Event,
  name: EntityName,
  chunk: number,
): Promise<SitemapRecord[]> {
  const supabase = useSupabaseAdmin(event);
  const from = (chunk - 1) * SITEMAP_CHUNK_SIZE;
  const to = from + SITEMAP_CHUNK_SIZE - 1;

  if (name === "voice-actors" || name === "studios") {
    const table = name === "voice-actors" ? "voice_actors" : "studios";
    const data = await fetchPaged(
      (start, end) =>
        supabase
          .from(table)
          .select("id, updated_at")
          .order("id", { ascending: true })
          .range(start, end),
      from,
      to,
    );
    const prefix = name === "voice-actors" ? "/voice-actor" : "/studio";
    return data.map((row) => ({
      path: `${prefix}/${row.id}`,
      lastmod: row.updated_at,
    }));
  }

  // Media pages are keyed by media.content_id, which is unique per kind, so each row is one page; its lastmod is
  // the latest update among the media's dubbing projects.
  const { contentType, pathPrefix } = MEDIA_CONTENT_TYPES[name];
  const rows = await fetchPaged(
    (rangeStart, rangeEnd) =>
      supabase
        .from("media")
        .select("content_id, dubbing_projects!inner(updated_at)")
        .eq("kind", contentType)
        .order("content_id", { ascending: true })
        .range(rangeStart, rangeEnd),
    from,
    to,
  );

  return rows.map((row) => ({
    path: `${pathPrefix}/${row.content_id}`,
    lastmod: row.dubbing_projects.reduce<string | null>(
      (newest, project) => latest(newest, project.updated_at),
      null,
    ),
  }));
}
