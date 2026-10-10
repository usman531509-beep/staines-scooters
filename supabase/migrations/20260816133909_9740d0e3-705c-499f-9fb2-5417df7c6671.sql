ALTER TABLE public.dawat_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_exp_month int,
  ADD COLUMN IF NOT EXISTS card_exp_year int,
  ADD COLUMN IF NOT EXISTS card_saved_at timestamptz;