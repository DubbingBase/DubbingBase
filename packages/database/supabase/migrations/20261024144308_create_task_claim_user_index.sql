-- pg-delta: transaction=false
-- Keep claim writes available while this index is built. An interrupted build
-- can leave an invalid index that CREATE INDEX IF NOT EXISTS would skip.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS index_relation
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_relation.relnamespace
    JOIN pg_catalog.pg_index AS index_metadata
      ON index_metadata.indexrelid = index_relation.oid
    WHERE index_namespace.nspname = 'public'
      AND index_relation.relname = 'gamification_task_locks_user_id_idx'
      AND NOT index_metadata.indisvalid
  ) THEN
    RAISE EXCEPTION 'gamification_task_locks_user_id_idx is invalid; drop it with DROP INDEX CONCURRENTLY and retry this migration';
  END IF;
END;
$$;

-- Supabase CLI 2.111.0 executes CREATE INDEX CONCURRENTLY outside the transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS gamification_task_locks_user_id_idx
  ON public.gamification_task_locks (user_id);
