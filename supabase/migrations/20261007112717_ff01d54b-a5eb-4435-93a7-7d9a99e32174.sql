ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_credit_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_customer_name text,
  ADD COLUMN IF NOT EXISTS credit_customer_email text,
  ADD COLUMN IF NOT EXISTS credit_customer_phone text,
  ADD COLUMN IF NOT EXISTS credit_customer_dob date,
  ADD COLUMN IF NOT EXISTS credit_customer_address text,
  ADD COLUMN IF NOT EXISTS credit_customer_bike_reg text,
  ADD COLUMN IF NOT EXISTS credit_pay_token text UNIQUE;

ALTER TABLE public.credit_payments
  ALTER COLUMN user_id DROP NOT NULL;