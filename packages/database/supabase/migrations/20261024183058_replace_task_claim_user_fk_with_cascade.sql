-- Claim rows are temporary task locks. Deleting their owner must not be
-- blocked by an expired claim that has not yet been reassigned.
-- Rollback can restore NO ACTION and drop the index; deleted claim rows are
-- ephemeral and do not need to be restored.
-- Defer validation of existing rows so the FK replacement does not scan them
-- while holding the DDL lock. New writes still obey this constraint.
ALTER TABLE public.gamification_task_locks
  DROP CONSTRAINT gamification_task_locks_user_id_fkey,
  ADD CONSTRAINT gamification_task_locks_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    NOT VALID;
