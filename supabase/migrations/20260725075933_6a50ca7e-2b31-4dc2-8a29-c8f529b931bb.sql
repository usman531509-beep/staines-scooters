ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS billing_day smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS autopay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_exp_month smallint,
  ADD COLUMN IF NOT EXISTS card_exp_year smallint,
  ADD COLUMN IF NOT EXISTS card_updated_at timestamptz;

ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_billing_day_check;
ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_billing_day_check CHECK (billing_day BETWEEN 0 AND 6);

ALTER TABLE public.rental_weeks
  ADD COLUMN IF NOT EXISTS charge_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_charge_error text,
  ADD COLUMN IF NOT EXISTS last_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text;

ALTER TABLE public.rental_settings
  ADD COLUMN IF NOT EXISTS default_billing_day smallint NOT NULL DEFAULT 1;