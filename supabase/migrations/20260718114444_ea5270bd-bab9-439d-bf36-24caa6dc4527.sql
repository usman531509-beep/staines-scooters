
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_run_date date,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_recurrence_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_recurrence_check
  CHECK (recurrence IN ('none','weekly','monthly'));

CREATE INDEX IF NOT EXISTS expenses_template_due_idx
  ON public.expenses (is_template, next_run_date)
  WHERE is_template = true;
