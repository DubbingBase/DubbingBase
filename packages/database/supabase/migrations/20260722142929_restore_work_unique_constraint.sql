-- Restore the unique constraint using the new dubbing_project_id column
ALTER TABLE "public"."work"
ADD CONSTRAINT "work_unique_assignment" UNIQUE ("dubbing_project_id", "actor_id", "voice_actor_id");
