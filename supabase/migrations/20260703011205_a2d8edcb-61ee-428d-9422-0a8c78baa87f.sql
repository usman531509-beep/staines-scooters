
-- 1) Tighten SELECT policy: only staff/admin/owner can read directly
DROP POLICY IF EXISTS "settings read authenticated" ON public.loyalty_settings;

CREATE POLICY "settings read staff"
  ON public.loyalty_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner','admin','staff')
    )
  );

-- 2) SECURITY DEFINER helper so authenticated server fns acting as the
--    customer can still load settings needed for points/vouchers logic.
CREATE OR REPLACE FUNCTION public.get_loyalty_settings()
RETURNS SETOF public.loyalty_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.loyalty_settings LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_loyalty_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_settings() TO authenticated, service_role;
