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


  -- Birthday vouchers are deliberately NOT issued at signup.
  -- They are issued only on the customer's actual birthday and are valid for 30 days.
  RETURN NEW;
END;
$$;

WITH today AS (
  SELECT (now() AT TIME ZONE 'Europe/London')::date AS d
), birthday_vouchers AS (
  SELECT
    v.id,
    p.date_of_birth,
    today.d AS today,
    EXTRACT(YEAR FROM today.d)::int AS current_year,
    EXTRACT(MONTH FROM p.date_of_birth)::int AS birth_month,
    EXTRACT(DAY FROM p.date_of_birth)::int AS birth_day
  FROM public.vouchers v
  LEFT JOIN public.profiles p ON p.id = v.user_id
  CROSS JOIN today
  WHERE v.status = 'active'
    AND v.deleted_at IS NULL
    AND (
      lower(coalesce(v.source, '')) LIKE '%birthday%'
      OR lower(coalesce(v.name, '')) LIKE '%birthday%'
    )
), birthday_dates AS (
  SELECT
    id,
    date_of_birth,
    today,
    make_date(
      current_year,
      birth_month,
      least(
        birth_day,
        EXTRACT(DAY FROM (date_trunc('month', make_date(current_year, birth_month, 1)) + interval '1 month - 1 day'))::int
      )
    ) AS birthday_this_year,
    make_date(
      current_year - 1,
      birth_month,
      least(
        birth_day,
        EXTRACT(DAY FROM (date_trunc('month', make_date(current_year - 1, birth_month, 1)) + interval '1 month - 1 day'))::int
      )
    ) AS birthday_last_year
  FROM birthday_vouchers
  WHERE date_of_birth IS NOT NULL
), birthday_windows AS (
  SELECT
    id,
    today,
    CASE WHEN birthday_this_year > today THEN birthday_last_year ELSE birthday_this_year END AS window_start
  FROM birthday_dates
), invalid_birthday_vouchers AS (
  SELECT bv.id
  FROM birthday_vouchers bv
  LEFT JOIN birthday_windows bw ON bw.id = bv.id
  WHERE bv.date_of_birth IS NULL
     OR bw.window_start IS NULL
     OR bv.today < bw.window_start
     OR bv.today >= bw.window_start + 30
)
UPDATE public.vouchers v
SET status = 'cancelled',
    deleted_at = COALESCE(v.deleted_at, now())
FROM invalid_birthday_vouchers invalid
WHERE v.id = invalid.id;