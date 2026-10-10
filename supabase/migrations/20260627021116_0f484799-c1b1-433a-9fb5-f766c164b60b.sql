
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','staff','customer');
CREATE TYPE public.card_status AS ENUM ('active','suspended','closed');
CREATE TYPE public.point_tx_type AS ENUM ('earn','redeem','adjust','refund','cash_out');
CREATE TYPE public.voucher_type AS ENUM ('fixed','percent','free_item','free_service');
CREATE TYPE public.voucher_status AS ENUM ('active','used','expired','cancelled');
CREATE TYPE public.offer_type AS ENUM ('buy_x_get_1','spend_threshold','category','bundle','level','birthday','referral','inactive','seasonal','double_points');
CREATE TYPE public.cash_out_status AS ENUM ('pending','approved','paid','rejected');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_staff_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin','staff'))
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin'))
$$;

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_owner(auth.uid()));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  address text,
  date_of_birth date,
  bike_make text,
  bike_model text,
  bike_reg text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_any_staff_role(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_owner(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin_or_owner(auth.uid()));

-- ============ LOYALTY CARDS ============
CREATE TABLE public.loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number text NOT NULL UNIQUE,
  barcode text NOT NULL UNIQUE,
  status public.card_status NOT NULL DEFAULT 'active',
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  lifetime_spend_pence integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_cards TO authenticated;
GRANT ALL ON public.loyalty_cards TO service_role;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON public.loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "own card read" ON public.loyalty_cards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));

-- ============ SALES (invoices) ============
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  points_awarded integer NOT NULL DEFAULT 0,
  voucher_id uuid,
  staff_id uuid REFERENCES auth.users(id),
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales read" ON public.sales FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));

-- ============ POINT TRANSACTIONS ============
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tx_type public.point_tx_type NOT NULL,
  points integer NOT NULL,
  reason text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  voucher_id uuid,
  cash_out_id uuid,
  staff_id uuid REFERENCES auth.users(id),
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own txs read" ON public.point_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));

-- ============ VOUCHERS ============
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  voucher_type public.voucher_type NOT NULL,
  value_pence integer NOT NULL DEFAULT 0,
  percent integer,
  min_spend_pence integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status public.voucher_status NOT NULL DEFAULT 'active',
  used_at timestamptz,
  used_sale_id uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vouchers read" ON public.vouchers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));

-- ============ OFFERS ============
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  offer_type public.offer_type NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_voucher_type public.voucher_type,
  reward_value_pence integer DEFAULT 0,
  reward_percent integer,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read active offers" ON public.offers FOR SELECT TO authenticated
  USING (active = true OR public.is_admin_or_owner(auth.uid()));

CREATE TABLE public.offer_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  target integer NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(offer_id, user_id)
);
GRANT SELECT ON public.offer_progress TO authenticated;
GRANT ALL ON public.offer_progress TO service_role;
ALTER TABLE public.offer_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.offer_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));

-- ============ CASH OUT REQUESTS ============
CREATE TABLE public.cash_out_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0),
  cash_value_pence integer NOT NULL CHECK (cash_value_pence > 0),
  status public.cash_out_status NOT NULL DEFAULT 'pending',
  payment_method text,
  customer_signature text,
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  paid_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  paid_at timestamptz
);
GRANT SELECT, INSERT ON public.cash_out_requests TO authenticated;
GRANT ALL ON public.cash_out_requests TO service_role;
ALTER TABLE public.cash_out_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cashout read" ON public.cash_out_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_staff_role(auth.uid()));
CREATE POLICY "self cashout create" ON public.cash_out_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ LOYALTY SETTINGS (singleton) ============
CREATE TABLE public.loyalty_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  points_per_pound integer NOT NULL DEFAULT 1,
  points_value_threshold integer NOT NULL DEFAULT 100, -- 100 points = £1
  min_cash_out_pence integer NOT NULL DEFAULT 500,
  max_daily_cash_out_pence integer NOT NULL DEFAULT 5000,
  cash_out_enabled boolean NOT NULL DEFAULT true,
  cash_out_requires_owner_approval boolean NOT NULL DEFAULT true,
  default_voucher_expiry_days integer NOT NULL DEFAULT 180,
  points_apply_after_discount boolean NOT NULL DEFAULT true,
  points_include_vat boolean NOT NULL DEFAULT true,
  rental_earns_points boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read settings" ON public.loyalty_settings FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.loyalty_settings (id) VALUES (true);

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

-- ============ AUTO-CREATE PROFILE + CARD ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card_no text;
  v_barcode text;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  v_card_no := 'HM-' || upper(substr(replace(NEW.id::text,'-',''), 1, 8));
  v_barcode := '977' || lpad((floor(random()*1e10))::bigint::text, 10, '0');
  INSERT INTO public.loyalty_cards (user_id, card_number, barcode)
  VALUES (NEW.id, v_card_no, v_barcode)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  -- Bootstrap the first owner by email

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
