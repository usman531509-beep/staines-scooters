-- Restore signup trigger: issue Happy Birthday welcome voucher immediately
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_no text;
  v_barcode text;
  v_card_id uuid;
  v_welcome_points integer := 99;
  v_full_name text;
  v_first_name text;
  v_bday_pence integer;
  v_voucher_code text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, v_full_name, NEW.email, NEW.raw_user_meta_data->>'phone')
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


  -- Happy Birthday welcome voucher — issued immediately at signup, valid 1 year
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

-- Reactivate any birthday-welcome vouchers that were auto-cancelled by the
-- earlier DOB-window sweep — the welcome voucher is intentionally NOT DOB-gated.
UPDATE public.vouchers
SET status = 'active', deleted_at = NULL
WHERE source = 'birthday-welcome'
  AND (status = 'cancelled' OR deleted_at IS NOT NULL)
  AND (expires_at IS NULL OR expires_at > now());

-- Backfill: create a birthday-welcome voucher for existing customers who don't have one
INSERT INTO public.vouchers (code, user_id, name, voucher_type, value_pence, expires_at, source)
SELECT
  'HMB-' || upper(substr(md5(p.id::text || clock_timestamp()::text || random()::text), 1, 8)),
  p.id,
  'Happy Birthday ' || COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'friend')
    || ' — £' || to_char(COALESCE((SELECT birthday_voucher_pence FROM public.loyalty_settings LIMIT 1), 500)/100.0, 'FM999999990.00')
    || ' gift from Stainess Scooter. Wishing you safety, peace, prosperity and good health. 🎂',
  'fixed',
  COALESCE((SELECT birthday_voucher_pence FROM public.loyalty_settings LIMIT 1), 500),
  now() + interval '365 days',
  'birthday-welcome'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.vouchers v
  WHERE v.user_id = p.id AND v.source = 'birthday-welcome'
);