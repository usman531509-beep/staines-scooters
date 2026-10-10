CREATE TABLE public.till_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opened_by uuid REFERENCES auth.users(id),
  closed_by uuid REFERENCES auth.users(id),
  opening_float_pence integer NOT NULL DEFAULT 0,
  closing_count_pence integer,
  expected_close_pence integer,
  variance_pence integer,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.till_sessions TO authenticated;
GRANT ALL ON public.till_sessions TO service_role;
ALTER TABLE public.till_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage till sessions" ON public.till_sessions
  FOR ALL TO authenticated
  USING (public.hx_has_access(auth.uid()))
  WITH CHECK (public.hx_has_access(auth.uid()));

CREATE TRIGGER trg_till_sessions_updated BEFORE UPDATE ON public.till_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.till_cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  till_session_id uuid NOT NULL REFERENCES public.till_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'cash_in',
  amount_pence integer NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.till_cash_movements TO authenticated;
GRANT ALL ON public.till_cash_movements TO service_role;
ALTER TABLE public.till_cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage till cash movements" ON public.till_cash_movements
  FOR ALL TO authenticated
  USING (public.hx_has_access(auth.uid()))
  WITH CHECK (public.hx_has_access(auth.uid()));

CREATE INDEX idx_till_cash_movements_session ON public.till_cash_movements(till_session_id);
CREATE INDEX idx_till_sessions_closed_at ON public.till_sessions(closed_at DESC);

ALTER TABLE public.sales
  ADD COLUMN till_session_id uuid REFERENCES public.till_sessions(id),
  ADD COLUMN cash_tendered_pence integer,
  ADD COLUMN cash_part_pence integer,
  ADD COLUMN card_part_pence integer;

CREATE INDEX idx_sales_till_session ON public.sales(till_session_id);