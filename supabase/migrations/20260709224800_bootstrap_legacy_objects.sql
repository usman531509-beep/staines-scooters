-- Bootstrap for a fresh database: these objects were created outside the migration
-- history in the previous project, but later migrations alter them. They belong to
-- removed features (Dawat, the legacy hx rental module, email), so the tables stay
-- empty and the access functions always deny. Generated from src/integrations/supabase/types.ts.

CREATE TABLE IF NOT EXISTS public.dawat_profiles (
  active boolean,
  avatar_url text,
  card_brand text,
  card_exp_month integer,
  card_exp_year integer,
  card_last4 text,
  card_saved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  default_payment_method_id text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_token text,
  role text,
  stripe_customer_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  username text
);
ALTER TABLE public.dawat_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dawat_dinners (
  calculation_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  cycle_number numeric,
  date date,
  deleted_at timestamptz,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id uuid,
  restaurant_name text,
  total_amount_pence integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dawat_dinners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dawat_dinner_attendees (
  amount_owed_pence integer,
  amount_paid_pence integer,
  attended boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  dinner_id uuid,
  paid_at timestamptz,
  profile_id uuid,
  stripe_payment_intent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dawat_dinner_attendees ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dawat_raffle_queue (
  created_at timestamptz NOT NULL DEFAULT now(),
  cycle_number numeric,
  dinner_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_at timestamptz,
  profile_id uuid,
  status text,
  turn_order numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dawat_raffle_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hx_agreements (
  actual_return_date date,
  body_html text,
  body_styles jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  customer_id uuid,
  deleted_at timestamptz,
  deposit_amount numeric,
  end_date date,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_deleted boolean,
  notes text,
  sent_at timestamptz,
  share_token uuid,
  signature_data text,
  signature_ip text,
  signature_name text,
  signature_user_agent text,
  signed_at timestamptz,
  signed_pdf_url text,
  signing_mode text,
  start_date date,
  status text,
  terms text,
  token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  vehicle_id uuid,
  viewed_at timestamptz,
  weekly_rent numeric
);
ALTER TABLE public.hx_agreements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  body_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  html text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  metadata jsonb,
  recipient_email text,
  status text,
  subject text,
  template_name text,
  user_id uuid
);
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  used_at timestamptz
);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_dawat_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.is_dawat_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.hx_has_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.hx_is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
