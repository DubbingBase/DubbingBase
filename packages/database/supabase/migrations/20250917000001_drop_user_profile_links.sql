-- Migration: Drop user_profile_links table and related indexes
-- Date: 2025-09-17
-- Reason: Table is redundant as data is already in user_profiles

-- Drop indexes first
DROP INDEX IF EXISTS idx_user_profile_links_user_id;
DROP INDEX IF EXISTS idx_user_profile_links_profile_id;

-- Drop the table
DROP TABLE IF EXISTS user_profile_links;
