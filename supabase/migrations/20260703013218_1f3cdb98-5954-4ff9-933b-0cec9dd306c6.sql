
-- 1) Restrict get_loyalty_settings execution: revoke from anon; require authenticated
REVOKE EXECUTE ON FUNCTION public.get_loyalty_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_loyalty_settings()
 RETURNS SETOF public.loyalty_settings
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY SELECT * FROM public.loyalty_settings LIMIT 1;
END;
$function$;

-- 2) loyalty_settings: add admin-only INSERT/DELETE policies
CREATE POLICY "settings insert admin" ON public.loyalty_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

CREATE POLICY "settings delete admin" ON public.loyalty_settings
  FOR DELETE TO authenticated
  USING (private.is_admin_or_owner(auth.uid()));

-- 3) cash_out_requests: prevent staff from tampering with customer-signed fields
CREATE OR REPLACE FUNCTION public.protect_cash_out_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only the owning customer may change their own signature/user_id/requested amount.
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id is immutable';
    END IF;
    IF NEW.customer_signature IS DISTINCT FROM OLD.customer_signature THEN
      RAISE EXCEPTION 'customer_signature can only be set by the customer';
    END IF;
    IF NEW.amount_pence IS DISTINCT FROM OLD.amount_pence THEN
      RAISE EXCEPTION 'amount cannot be modified by staff';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_cash_out_immutable_fields ON public.cash_out_requests;
CREATE TRIGGER trg_protect_cash_out_immutable_fields
  BEFORE UPDATE ON public.cash_out_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_cash_out_immutable_fields();
