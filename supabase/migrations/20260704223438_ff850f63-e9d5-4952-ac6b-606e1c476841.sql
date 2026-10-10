
-- 1. Soft-delete columns
ALTER TABLE public.categories    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.expenses      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.refunds       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.sales         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.loyalty_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at    ON public.categories    (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at      ON public.products      (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at      ON public.expenses      (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_deleted_at       ON public.refunds       (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_deleted_at         ON public.sales         (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at      ON public.profiles      (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_deleted_at ON public.loyalty_cards (deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Loyalty cards: customers must not self-mutate points/level/status.
DROP POLICY IF EXISTS "loyalty_cards write staff" ON public.loyalty_cards;

CREATE POLICY "loyalty_cards staff manage"
  ON public.loyalty_cards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff'))
  );

-- (existing "own card read" SELECT policy stays, giving customers read-only access to their own card.)

-- 3. Profiles: prevent customers from editing referral reward fields via a trigger.
CREATE OR REPLACE FUNCTION public.protect_profile_reward_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND ur.role IN ('owner','admin','staff'))
    INTO is_staff;

  IF NOT is_staff AND auth.uid() = OLD.id THEN
    IF NEW.referral_rewarded IS DISTINCT FROM OLD.referral_rewarded THEN
      RAISE EXCEPTION 'referral_rewarded can only be changed by staff';
    END IF;
    IF NEW.referral_reward_points IS DISTINCT FROM OLD.referral_reward_points THEN
      RAISE EXCEPTION 'referral_reward_points can only be changed by staff';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'referral_code cannot be changed';
    END IF;
    IF NEW.referred_by IS DISTINCT FROM OLD.referred_by AND OLD.referred_by IS NOT NULL THEN
      RAISE EXCEPTION 'referred_by cannot be changed once set';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_reward_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_reward_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_reward_fields();
