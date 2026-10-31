import type { Database } from "@app/shared-logic";
import { buildSitemapUrls } from "../../utils/sitemap-urls";

const SITEMAP_PAGE_SIZE = 1000;

async function fetchPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SITEMAP_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SITEMAP_PAGE_SIZE - 1);
    if (error) {
      throw createError({
        statusCode: 502,
        statusMessage: "Failed to load sitemap data",
        cause: error,
      });
    }

    rows.push(...(data || []));
    if (!data || data.length < SITEMAP_PAGE_SIZE) return rows;
  }
}

export default defineSitemapEventHandler(async () => {
  const supabase = useSupabaseAdmin();
  type ProjectRow = Pick<
    Database["public"]["Tables"]["dubbing_projects"]["Row"],
    "content_id" | "content_type" | "updated_at"
  >;
  type ActorRow = Pick<Database["public"]["Tables"]["work"]["Row"], "actor_id" | "updated_at">;
  type VoiceActorRow = Pick<
    Database["public"]["Tables"]["voice_actors"]["Row"],
    "id" | "updated_at"
  >;
  type ToyRow = Pick<
    Database["public"]["Tables"]["toy_metadata"]["Row"],
    "content_id" | "updated_at"
  >;

  const [projects, actorWork, voiceActors, toys] = await Promise.all([
    fetchPages<ProjectRow>((from, to) =>
      Promise.resolve(
        supabase
          .from("dubbing_projects")
          .select("content_id, content_type, updated_at")
          .order("id")
          .range(from, to),
      ),
    ),
    fetchPages<ActorRow>((from, to) =>
      Promise.resolve(
        supabase
          .from("work")
          .select("actor_id, updated_at")
          .not("actor_id", "is", null)
          .order("id")
          .range(from, to),
      ),
    ),
    fetchPages<VoiceActorRow>((from, to) =>
      Promise.resolve(
        supabase.from("voice_actors").select("id, updated_at").order("id").range(from, to),
      ),
    ),
    fetchPages<ToyRow>((from, to) =>
      Promise.resolve(
        supabase
          .from("toy_metadata")
          .select("content_id, updated_at")
          .order("content_id")
          .range(from, to),
      ),
    ),
  ]);

  return buildSitemapUrls(
    projects,
    actorWork.flatMap((row) =>
      row.actor_id ? [{ id: row.actor_id, updated_at: row.updated_at }] : [],
    ),
    voiceActors,
    toys,
  );
});
