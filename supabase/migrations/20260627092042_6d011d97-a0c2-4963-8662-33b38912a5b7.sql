ALTER TABLE public.loyalty_settings DROP COLUMN IF EXISTS cron_secret;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION private.has_any_staff_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin','staff'))
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin'))
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_any_staff_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin_or_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_any_staff_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR private.is_admin_or_owner(auth.uid()))
  WITH CHECK ((id = auth.uid()) OR private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "own card read" ON public.loyalty_cards;
CREATE POLICY "own card read" ON public.loyalty_cards FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "own sales read" ON public.sales;
CREATE POLICY "own sales read" ON public.sales FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "own txs read" ON public.point_transactions;
CREATE POLICY "own txs read" ON public.point_transactions FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "own vouchers read" ON public.vouchers;
CREATE POLICY "own vouchers read" ON public.vouchers FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "all read active offers" ON public.offers;
CREATE POLICY "all read active offers" ON public.offers FOR SELECT TO authenticated
  USING ((active = true) OR private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "own progress read" ON public.offer_progress;
CREATE POLICY "own progress read" ON public.offer_progress FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "own cashout read" ON public.cash_out_requests;
CREATE POLICY "own cashout read" ON public.cash_out_requests FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "admins read audit" ON public.audit_log;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "fraud_flags admin only" ON public.fraud_flags;
CREATE POLICY "fraud_flags admin only" ON public.fraud_flags FOR ALL TO authenticated
  USING (private.is_admin_or_owner(auth.uid()))
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "email_log admin read" ON public.email_log;
CREATE POLICY "email_log admin read" ON public.email_log FOR SELECT TO authenticated
  USING (private.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "email_log admin write" ON public.email_log;
CREATE POLICY "email_log admin write" ON public.email_log FOR ALL TO authenticated
  USING (private.is_admin_or_owner(auth.uid()))
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_any_staff_role(uuid);
DROP FUNCTION IF EXISTS public.is_admin_or_owner(uuid);