
-- ===== Loyalty levels =====
ALTER TABLE public.loyalty_cards
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'Bronze';

ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS level_silver_pence bigint NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS level_gold_pence bigint NOT NULL DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS level_vip_pence bigint NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS birthday_voucher_pence integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS inactive_days integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS inactive_voucher_pence integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS referral_voucher_pence integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS cron_secret text;

UPDATE public.loyalty_settings SET cron_secret = encode(gen_random_bytes(24),'hex') WHERE cron_secret IS NULL;

-- Trigger to recompute level on lifetime spend change
CREATE OR REPLACE FUNCTION public.recompute_loyalty_level()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT level_silver_pence, level_gold_pence, level_vip_pence
    INTO s FROM public.loyalty_settings LIMIT 1;
  IF s IS NULL THEN RETURN NEW; END IF;
  NEW.level := CASE
    WHEN NEW.lifetime_spend_pence >= s.level_vip_pence THEN 'VIP'
    WHEN NEW.lifetime_spend_pence >= s.level_gold_pence THEN 'Gold'
    WHEN NEW.lifetime_spend_pence >= s.level_silver_pence THEN 'Silver'
    ELSE 'Bronze'
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recompute_level ON public.loyalty_cards;
CREATE TRIGGER trg_recompute_level
  BEFORE INSERT OR UPDATE OF lifetime_spend_pence ON public.loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION public.recompute_loyalty_level();

-- ===== Referrals =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_rewarded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'HM' || upper(substr(replace(NEW.id::text,'-',''),1,6));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_code ON public.profiles;
CREATE TRIGGER trg_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

UPDATE public.profiles SET referral_code = 'HM' || upper(substr(replace(id::text,'-',''),1,6))
  WHERE referral_code IS NULL;

-- ===== Soft delete (recycle bin) =====
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.offers   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ===== Fraud flags =====
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_flags TO authenticated;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_flags admin only" ON public.fraud_flags FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ===== Email log =====
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_address text NOT NULL,
  subject text NOT NULL,
  body text,
  template text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log admin read" ON public.email_log FOR SELECT TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "email_log admin write" ON public.email_log FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ===== Recompute existing card levels =====
UPDATE public.loyalty_cards SET lifetime_spend_pence = lifetime_spend_pence;
