-- Validate legacy claim rows in a separate transaction from the FK replacement.
ALTER TABLE public.gamification_task_locks
  VALIDATE CONSTRAINT gamification_task_locks_user_id_fkey;
