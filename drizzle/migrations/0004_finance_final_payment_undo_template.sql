ALTER TABLE public.finance_agreements ADD COLUMN IF NOT EXISTS final_payment_pence integer;
ALTER TABLE public.finance_settings ADD COLUMN IF NOT EXISTS agreement_template text;
CREATE TABLE public.finance_undo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.finance_agreements(id) ON DELETE CASCADE,
  label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
GRANT ALL ON public.finance_undo TO service_role;
ALTER TABLE public.finance_undo ENABLE ROW LEVEL SECURITY;
CREATE INDEX finance_undo_agreement_idx ON public.finance_undo(agreement_id, created_at DESC);