-- Existing work rows predate optimistic concurrency checks. Preserve the best
-- available timestamp for each row, while avoiding the update trigger which
-- would replace the backfill value with the migration time.
ALTER TABLE public.work DISABLE TRIGGER set_updated_columns_work;

UPDATE public.work
SET updated_at = COALESCE(updated_at, created_at, clock_timestamp())
WHERE updated_at IS NULL;

ALTER TABLE public.work ENABLE TRIGGER set_updated_columns_work;

ALTER TABLE public.work
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
