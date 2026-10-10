
-- 1) categories: staff-only read (was: any authenticated)
DROP POLICY IF EXISTS "categories read all authed" ON public.categories;
CREATE POLICY "categories read staff"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (private.has_any_staff_role(auth.uid()));

-- 2) loyalty_settings: staff-only direct read; customers go through RPC
DROP POLICY IF EXISTS "all read settings" ON public.loyalty_settings;
CREATE POLICY "settings read staff"
  ON public.loyalty_settings
  FOR SELECT
  TO authenticated
  USING (private.has_any_staff_role(auth.uid()));

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
GRANT EXECUTE ON FUNCTION public.get_loyalty_settings() TO authenticated;

-- 3) purchase_order_items: explicit staff SELECT policy alongside the ALL manage policy
DROP POLICY IF EXISTS "Staff read PO items" ON public.purchase_order_items;
CREATE POLICY "Staff read PO items"
  ON public.purchase_order_items
  FOR SELECT
  TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
