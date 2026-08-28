-- Migration: Audiobook Support
-- Adds support for 'audiobook' as a first-class content_type.
-- No new tables are required — dubbing_projects already accepts any string for
-- content_type, and work links to dubbing_projects via dubbing_project_id.
-- This migration adds:
--   1. DB comments documenting the allowed content_type values
--   2. DB comments documenting the enqueue_media_fetch extension

-- ─── 1. Document allowed content_type values ────────────────────────────────

COMMENT ON COLUMN public.dubbing_projects.content_type IS
  'Allowed values: ''movie'', ''tv'', ''video_game'', ''audiobook''';

-- ─── 2. Document enqueue_media_fetch extension ──────────────────────────────

COMMENT ON FUNCTION public.enqueue_media_fetch IS
  'Enqueues a media fetch job. p_media_type accepts: ''movie'', ''tv'', ''video_game'', ''audiobook''.
   For video_game, p_tmdb_id holds the IGDB game ID.
   For audiobook, p_tmdb_id holds the OpenLibrary work ID or ISBN-13.';
