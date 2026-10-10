ALTER TABLE public.dawat_dinners ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS dawat_dinners_deleted_at_idx ON public.dawat_dinners(deleted_at);