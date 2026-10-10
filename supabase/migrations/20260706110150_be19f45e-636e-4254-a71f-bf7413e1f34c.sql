CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card_no text;
  v_barcode text;
  v_card_id uuid;
  v_welcome_points integer := 99;
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


  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;