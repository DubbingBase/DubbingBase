ALTER TABLE work
ADD CONSTRAINT work_unique UNIQUE (voice_actor_id, content_id, actor_id, content_type);
