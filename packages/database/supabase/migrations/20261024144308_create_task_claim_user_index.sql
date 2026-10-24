-- pg-delta: transaction=false
-- Keep claim writes available while this index is built.
-- Drop first so a retry also removes any invalid index left by an interrupted build.
DROP INDEX CONCURRENTLY IF EXISTS gamification_task_locks_user_id_idx;

CREATE INDEX CONCURRENTLY gamification_task_locks_user_id_idx
  ON public.gamification_task_locks (user_id);
