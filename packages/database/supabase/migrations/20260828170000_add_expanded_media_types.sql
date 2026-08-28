-- Migration: 20260828170000_add_expanded_media_types.sql
-- Description: Expand supported content_type values for dubbing_projects to include:
--   - 'advertisement' (TV/Radio/Web commercial spots)
--   - 'podcast' (Audio fictions, podcasts, radio plays)
--   - 'toy' (Interactive connected toys, audio storytellers like Lunii/Toniebox/VTech)

COMMENT ON COLUMN public.dubbing_projects.content_type IS 'Type of content: movie, tv, season, episode, video_game, audiobook, advertisement, podcast, toy';
