
-- 1) Deduplicate existing phone numbers (keep the newest, null the older duplicates)
WITH ranked AS (
  SELECT id, phone, row_number() OVER (
    PARTITION BY regexp_replace(phone,'\D','','g')
    ORDER BY created_at DESC NULLS LAST, id
  ) AS rn
  FROM public.profiles
  WHERE phone IS NOT NULL AND phone <> ''
)
UPDATE public.profiles p SET phone = NULL
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 2) Enforce unique normalized phone (partial index, ignores NULL/empty)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_normalized_unique
  ON public.profiles ((regexp_replace(phone,'\D','','g')))
  WHERE phone IS NOT NULL AND phone <> '';

-- 3) RPC: check if a phone number is available (callable by anon during signup)
CREATE OR REPLACE FUNCTION public.phone_available(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone IS NOT NULL
      AND regexp_replace(phone,'\D','','g') = regexp_replace(p_phone,'\D','','g')
      AND regexp_replace(p_phone,'\D','','g') <> ''
  );
$$;
REVOKE ALL ON FUNCTION public.phone_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_available(text) TO anon, authenticated;

-- 4) RPC: resolve phone number to account email (for phone-based sign-in)
CREATE OR REPLACE FUNCTION public.email_for_phone(p_phone text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles
  WHERE phone IS NOT NULL
    AND email IS NOT NULL
    AND regexp_replace(phone,'\D','','g') = regexp_replace(p_phone,'\D','','g')
    AND regexp_replace(p_phone,'\D','','g') <> ''
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.email_for_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_for_phone(text) TO anon, authenticated;

-- 5) Update handle_new_user trigger to also issue a welcome birthday voucher
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card_no text;
  v_barcode text;
  v_card_id uuid;
  v_welcome_points integer := 99;
  v_bday_pence integer;
  v_full_name text;
  v_first_name text;
  v_voucher_code text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  v_card_no := 'HM-' || upper(substr(replace(NEW.id::text,'-',''), 1, 8));
  v_barcode := '977' || lpad((floor(random()*1e10))::bigint::text, 10, '0');
  INSERT INTO public.loyalty_cards (user_id, card_number, barcode, points_balance)
  VALUES (NEW.id, v_card_no, v_barcode, v_welcome_points)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_card_id;

  IF v_card_id IS NOT NULL THEN
    INSERT INTO public.point_transactions (card_id, user_id, tx_type, points, reason, balance_after)
    VALUES (v_card_id, NEW.id, 'earn', v_welcome_points, 'Welcome gift', v_welcome_points);
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;


  -- Welcome birthday voucher — issued immediately on registration
  SELECT COALESCE(birthday_voucher_pence, 500) INTO v_bday_pence FROM public.loyalty_settings LIMIT 1;
  IF v_bday_pence IS NULL OR v_bday_pence <= 0 THEN v_bday_pence := 500; END IF;
  v_first_name := COALESCE(NULLIF(split_part(v_full_name, ' ', 1), ''), 'friend');
  v_voucher_code := 'HMB-' || upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vouchers (code, user_id, name, voucher_type, value_pence, expires_at, source)
  VALUES (
    v_voucher_code,
    NEW.id,
    'Happy Birthday ' || v_first_name || ' — £' || to_char(v_bday_pence/100.0, 'FM999999990.00') || ' gift from Stainess Scooter. Wishing you safety, peace, prosperity and good health. 🎂',
    'fixed',
    v_bday_pence,
    now() + interval '365 days',
    'birthday-welcome'
  )
  ON CONFLICT (code) DO NOTHING;

  RETURN NEW;
END;
$$;
