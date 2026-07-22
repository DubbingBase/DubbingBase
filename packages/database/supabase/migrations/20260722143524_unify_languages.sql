-- 1. Update existing records
UPDATE "public"."dubbing_projects"
SET language = 'fr-FR'
WHERE language = 'fr';

-- 2. Update default column value for future records
ALTER TABLE "public"."dubbing_projects"
ALTER COLUMN "language" SET DEFAULT 'fr-FR'::text;
