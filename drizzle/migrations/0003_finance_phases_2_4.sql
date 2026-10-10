CREATE TABLE public.finance_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.finance_agreements(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'return',
  status text NOT NULL DEFAULT 'recovered',
  recovered_on date NOT NULL DEFAULT current_date,
  mileage text, condition text,
  valuation_pence int NOT NULL DEFAULT 0,
  costs_pence int NOT NULL DEFAULT 0,
  sale_pence int NOT NULL DEFAULT 0,
  sold_on date,
  court_order_ref text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_recoveries TO authenticated;
GRANT ALL ON public.finance_recoveries TO service_role;
ALTER TABLE public.finance_recoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read recoveries" ON public.finance_recoveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

CREATE TABLE public.finance_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from date NOT NULL,
  period_to date NOT NULL,
  method text NOT NULL,
  expected_pence int NOT NULL DEFAULT 0,
  actual_pence int NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_reconciliations TO authenticated;
GRANT ALL ON public.finance_reconciliations TO service_role;
ALTER TABLE public.finance_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read reconciliations" ON public.finance_reconciliations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

CREATE TABLE public.finance_permissions (
  user_id uuid PRIMARY KEY,
  perms text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_permissions TO authenticated;
GRANT ALL ON public.finance_permissions TO service_role;
ALTER TABLE public.finance_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read finance perms" ON public.finance_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin')));