ALTER TABLE public.rental_arrears_plans
  ADD COLUMN IF NOT EXISTS pay_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_exp_month integer,
  ADD COLUMN IF NOT EXISTS card_exp_year integer,
  ADD COLUMN IF NOT EXISTS card_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_email_at timestamptz;

ALTER TABLE public.rental_arrears_installments
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text;

UPDATE public.rental_arrears_plans
SET pay_token = replace(gen_random_uuid()::text, '-', '')
WHERE pay_token IS NULL;