-- Remove redundant columns from the work table
ALTER TABLE "public"."work"
DROP COLUMN IF EXISTS "content_id",
DROP COLUMN IF EXISTS "content_type";

-- Remove redundant studio column from dubbing_projects
ALTER TABLE "public"."dubbing_projects"
DROP COLUMN IF EXISTS "studio";
