-- Migration: Video Game Support
-- Adds support for 'video_game' as a first-class content_type.
-- No new tables are required — dubbing_projects already accepts any string for
-- content_type, and work links to dubbing_projects via dubbing_project_id.
-- This migration adds:
--   1. A composite index to speed up queries on (content_type, content_id)
--   2. DB comments documenting the allowed content_type values

-- ─── 1. Index for (content_type, content_id) lookups ───────────────────────

CREATE INDEX IF NOT EXISTS idx_dubbing_projects_type_content
  ON public.dubbing_projects (content_type, content_id);

-- ─── 2. Document allowed content_type values ────────────────────────────────

COMMENT ON COLUMN public.dubbing_projects.content_type IS
  'Allowed values: ''movie'', ''tv'', ''video_game''';

-- ─── 3. Document enqueue_media_fetch extension ──────────────────────────────
-- The existing enqueue_media_fetch RPC accepts a p_media_type text parameter.
-- video_game is a new valid value — no schema change needed, but we add a
-- comment as audit trail that the queue processor handles it.

COMMENT ON FUNCTION public.enqueue_media_fetch IS
  'Enqueues a media fetch job. p_media_type accepts: ''movie'', ''tv'', ''video_game''.
   For video_game, p_tmdb_id holds the IGDB game ID.';
