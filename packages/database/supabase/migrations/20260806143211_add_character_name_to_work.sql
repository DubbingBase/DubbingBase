ALTER TABLE "public"."work" ADD COLUMN "character_name" text;
ALTER TABLE "public"."work" ADD COLUMN "character_id" bigint;

ALTER TABLE "public"."work" DROP CONSTRAINT IF EXISTS "work_unique_assignment";
ALTER TABLE "public"."work" ALTER COLUMN "actor_id" DROP NOT NULL;

ALTER TABLE "public"."work"
ADD CONSTRAINT "work_unique_assignment" UNIQUE ("dubbing_project_id", "actor_id", "character_id", "voice_actor_id");
