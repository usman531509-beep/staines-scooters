ALTER TABLE public.rental_weeks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS rental_weeks_deleted_at_idx ON public.rental_weeks (deleted_at);