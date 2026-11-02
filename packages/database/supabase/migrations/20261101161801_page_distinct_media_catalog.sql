CREATE OR REPLACE FUNCTION public.page_media_catalog(
  p_content_type text,
  p_page integer,
  p_page_size integer
)
RETURNS TABLE (
  content_ids bigint[],
  page integer,
  page_size integer,
  total_items bigint,
  total_pages integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  WITH newest_projects AS MATERIALIZED (
    SELECT DISTINCT ON (projects.content_id)
      projects.content_id,
      projects.created_at,
      projects.id
    FROM public.dubbing_projects AS projects
    WHERE projects.content_type = p_content_type
    ORDER BY projects.content_id, projects.created_at DESC, projects.id DESC
  ),
  totals AS (
    SELECT count(*)::bigint AS total_items
    FROM newest_projects
  ),
  page_settings AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 48) AS page_size,
      GREATEST(COALESCE(p_page, 1), 1) AS requested_page,
      totals.total_items
    FROM totals
  ),
  page_info AS (
    SELECT
      page_settings.page_size,
      LEAST(
        page_settings.requested_page,
        GREATEST(
          1,
          ((page_settings.total_items + page_settings.page_size - 1)
            / page_settings.page_size)::integer
        )
      ) AS page,
      page_settings.total_items,
      GREATEST(
        1,
        ((page_settings.total_items + page_settings.page_size - 1)
          / page_settings.page_size)::integer
      ) AS total_pages
    FROM page_settings
  ),
  numbered_projects AS (
    SELECT
      projects.content_id,
      row_number() OVER (ORDER BY projects.created_at DESC, projects.id DESC) AS position
    FROM newest_projects AS projects
  )
  SELECT
    ARRAY(
      SELECT projects.content_id
      FROM numbered_projects AS projects
      WHERE projects.position > (page_info.page - 1)::bigint * page_info.page_size
        AND projects.position <= page_info.page::bigint * page_info.page_size
      ORDER BY projects.position
    ),
    page_info.page,
    page_info.page_size,
    page_info.total_items,
    page_info.total_pages
  FROM page_info;
$function$;

REVOKE ALL ON FUNCTION public.page_media_catalog(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.page_media_catalog(text, integer, integer)
  TO service_role;
