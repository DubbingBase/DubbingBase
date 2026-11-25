-- Public pages are crawled by id (actors by TMDB id, media by provider id). Most crawled ids have no row in
-- DubbingBase, and each one still costs a logged Supabase request. The website keeps this compact snapshot of the
-- ids that DO have data (cached in KV for a couple of minutes), so it can answer "no data" for the others without
-- querying the database.
--
-- `media`: provider ids per media kind, taken from the `media` table (a superset of the media that have projects).
-- `actors`: distinct `work.actor_id`, the key the actor page filters on.
-- The snapshot is read-only, derives from public data, and is executable by the service role only.
CREATE OR REPLACE FUNCTION public.get_known_content_ids()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'media',
    COALESCE(
      (
        SELECT jsonb_object_agg(per_kind.kind, per_kind.ids)
        FROM (
          SELECT m.kind, jsonb_agg(m.content_id ORDER BY m.content_id) AS ids
          FROM public.media AS m
          GROUP BY m.kind
        ) AS per_kind
      ),
      '{}'::jsonb
    ),
    'actors',
    COALESCE(
      (
        SELECT jsonb_agg(w.actor_id ORDER BY w.actor_id)
        FROM (
          SELECT DISTINCT actor_id
          FROM public.work
          WHERE actor_id IS NOT NULL
        ) AS w
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_known_content_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_known_content_ids() TO service_role;

NOTIFY pgrst, 'reload schema';
