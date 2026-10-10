ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS undo_id uuid;
CREATE INDEX IF NOT EXISTS finance_transactions_undo_id_idx ON public.finance_transactions(undo_id);