-- Bootstrap for a fresh database: rental arrears plans and Stripe Connect accounts were
-- created outside the migration history in the previous project. The next migration adds
-- the card/pay-link columns to the arrears tables. Rows are managed through the server
-- (service role) and by rental staff.
CREATE TABLE IF NOT EXISTS public.rental_arrears_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Arrears plan',
  total_pence integer NOT NULL CHECK (total_pence >= 0),
  weekly_pence integer NOT NULL CHECK (weekly_pence >= 0),
  final_pence integer NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  vehicles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_arrears_plans_user ON public.rental_arrears_plans (user_id);

CREATE TABLE IF NOT EXISTS public.rental_arrears_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.rental_arrears_plans(id) ON DELETE CASCADE,
  admin_id uuid DEFAULT auth.uid(),
  seq integer NOT NULL,
  due_date date NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  status text NOT NULL DEFAULT 'due',
  paid_at timestamptz,
  method text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, seq)
);

CREATE TABLE IF NOT EXISTS public.rental_stripe_accounts (
  admin_id uuid PRIMARY KEY,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  livemode boolean NOT NULL DEFAULT false,
  display_name text,
  email text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_arrears_plans, public.rental_arrears_installments TO authenticated;
GRANT ALL ON public.rental_arrears_plans, public.rental_arrears_installments, public.rental_stripe_accounts TO service_role;
ALTER TABLE public.rental_arrears_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_arrears_installments ENABLE ROW LEVEL SECURITY;
-- Connect accounts are only read and written by the server with the service role.
ALTER TABLE public.rental_stripe_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rental_arrears_plans_staff ON public.rental_arrears_plans FOR ALL TO authenticated
  USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY rental_arrears_installments_staff ON public.rental_arrears_installments FOR ALL TO authenticated
  USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
