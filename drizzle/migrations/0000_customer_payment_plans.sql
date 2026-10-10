CREATE TABLE public.customer_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Payment plan',
  notes text,
  total_pence integer NOT NULL CHECK (total_pence > 0),
  installment_count integer NOT NULL CHECK (installment_count > 0 AND installment_count <= 520),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly')),
  start_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_cpp_customer ON public.customer_payment_plans(customer_id);

CREATE TABLE public.customer_payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.customer_payment_plans(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  due_date date NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  paid_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid')),
  paid_at timestamptz,
  method text,
  stripe_payment_intent text,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cppi_plan ON public.customer_payment_plan_installments(plan_id);

CREATE TABLE public.customer_saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'live',
  stripe_customer_id text NOT NULL,
  payment_method_id text NOT NULL UNIQUE,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_csc_user ON public.customer_saved_cards(user_id);

CREATE TABLE public.customer_stripe_customers (
  user_id uuid NOT NULL,
  environment text NOT NULL,
  stripe_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, environment)
);

GRANT SELECT ON public.customer_payment_plans TO authenticated;
GRANT SELECT ON public.customer_payment_plan_installments TO authenticated;
GRANT SELECT ON public.customer_saved_cards TO authenticated;
GRANT ALL ON public.customer_payment_plans TO service_role;
GRANT ALL ON public.customer_payment_plan_installments TO service_role;
GRANT ALL ON public.customer_saved_cards TO service_role;
GRANT ALL ON public.customer_stripe_customers TO service_role;

ALTER TABLE public.customer_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans visible to owner or staff" ON public.customer_payment_plans FOR SELECT TO authenticated
USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE POLICY "Installments visible to owner or staff" ON public.customer_payment_plan_installments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_payment_plans p WHERE p.id = plan_id AND (p.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "Cards visible to owner or staff" ON public.customer_saved_cards FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));