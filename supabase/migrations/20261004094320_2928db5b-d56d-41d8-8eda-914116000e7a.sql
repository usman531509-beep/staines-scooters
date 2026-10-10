CREATE OR REPLACE FUNCTION public.vouchers_no_expiry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.expires_at := NULL;
  IF NEW.status = 'expired' THEN NEW.status := 'active'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS vouchers_no_expiry ON public.vouchers;
CREATE TRIGGER vouchers_no_expiry BEFORE INSERT OR UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.vouchers_no_expiry();