CREATE TABLE public.finance_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name text NOT NULL DEFAULT 'Stainess Scooter Ltd',
  company_number text, fca_frn text, trading_address text,
  registered_address text, phone text, email text,
  default_rate_pct numeric(8,4) NOT NULL DEFAULT 12, default_method text NOT NULL DEFAULT 'reducing',
  late_fee_pence int NOT NULL DEFAULT 0, reminder_days_before int NOT NULL DEFAULT 3,
  extra_terms text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.finance_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read finance settings" ON public.finance_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE POLICY "admin update finance settings" ON public.finance_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin')));

CREATE TABLE public.finance_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no serial,
  customer_id uuid,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'quote',
  cash_price_pence int NOT NULL DEFAULT 0,
  accessories_pence int NOT NULL DEFAULT 0,
  fees_pence int NOT NULL DEFAULT 0,
  deposit_pence int NOT NULL DEFAULT 0,
  part_ex_pence int NOT NULL DEFAULT 0,
  part_ex_settlement_pence int NOT NULL DEFAULT 0,
  credit_pence int NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'reducing',
  rate_pct numeric(8,4) NOT NULL DEFAULT 0,
  apr_pct numeric(8,2) NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  term_count int NOT NULL DEFAULT 12,
  first_payment_date date NOT NULL DEFAULT current_date,
  interest_pence int NOT NULL DEFAULT 0,
  total_payable_pence int NOT NULL DEFAULT 0,
  instalment_pence int NOT NULL DEFAULT 0,
  affordability jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  sign_token text UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  signed_name text, signed_at timestamptz, signed_ip text, signature_data text,
  company_signed_by uuid, company_signed_at timestamptz,
  withdrawal_deadline date,
  autopay_enabled boolean NOT NULL DEFAULT true,
  autopay_card_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT ON public.finance_agreements TO authenticated;
GRANT ALL ON public.finance_agreements TO service_role;
ALTER TABLE public.finance_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff or owner read agreements" ON public.finance_agreements FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

CREATE TABLE public.finance_instalments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.finance_agreements(id) ON DELETE CASCADE,
  seq int NOT NULL,
  due_date date NOT NULL,
  opening_pence int NOT NULL,
  amount_pence int NOT NULL,
  interest_pence int NOT NULL,
  principal_pence int NOT NULL,
  closing_pence int NOT NULL,
  paid_pence int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'due',
  paid_at timestamptz,
  method text,
  stripe_payment_intent text,
  last_charge_error text, last_charge_at timestamptz, charge_attempts int NOT NULL DEFAULT 0,
  UNIQUE (agreement_id, seq)
);
CREATE INDEX ON public.finance_instalments (due_date) WHERE status = 'due';
GRANT SELECT ON public.finance_instalments TO authenticated;
GRANT ALL ON public.finance_instalments TO service_role;
ALTER TABLE public.finance_instalments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read instalments" ON public.finance_instalments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.finance_agreements a WHERE a.id = agreement_id AND (a.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));

CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.finance_agreements(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount_pence int NOT NULL DEFAULT 0,
  principal_pence int NOT NULL DEFAULT 0,
  interest_pence int NOT NULL DEFAULT 0,
  method text,
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read finance tx" ON public.finance_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.finance_agreements a WHERE a.id = agreement_id AND (a.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE OR REPLACE FUNCTION public.finance_tx_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Finance transactions are immutable; record a reversal instead'; END $$;
CREATE TRIGGER finance_tx_no_change BEFORE UPDATE OR DELETE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION public.finance_tx_immutable();