ALTER TABLE public.customer_payment_plans
  ADD COLUMN IF NOT EXISTS autopay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_card_id uuid;
ALTER TABLE public.customer_payment_plan_installments
  ADD COLUMN IF NOT EXISTS last_charge_error text,
  ADD COLUMN IF NOT EXISTS last_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS charge_attempts integer NOT NULL DEFAULT 0;