
-- 1) Move handle_new_user to private schema (SECURITY DEFINER trigger, no longer exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.handle_new_user()
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


  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2) Drop the SECURITY DEFINER get_loyalty_settings RPC and allow authenticated users to read the (non-sensitive) settings row directly.
DROP FUNCTION IF EXISTS public.get_loyalty_settings();

DROP POLICY IF EXISTS "settings read staff" ON public.loyalty_settings;
CREATE POLICY "settings read authenticated"
  ON public.loyalty_settings FOR SELECT
  TO authenticated
  USING (true);

-- 3) Add an explicit SELECT policy for staff on purchase_orders (in addition to the existing ALL policy)
CREATE POLICY "Staff read POs"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
