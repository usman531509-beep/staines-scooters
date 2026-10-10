
-- Drop public.has_role and all dependent policies (we recreate them below)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- Recreate dependent policies using private.has_role / private.has_any_staff_role
-- user_roles
CREATE POLICY "Only owners can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Only owners can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Only owners can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

-- appointments
CREATE POLICY "Customers view own appts" ON public.appointments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff manage appts" ON public.appointments
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- cash_out_requests
CREATE POLICY "Staff can delete cash out requests" ON public.cash_out_requests
  FOR DELETE TO authenticated
  USING (private.is_admin_or_owner(auth.uid()));
CREATE POLICY "Staff can update cash out requests" ON public.cash_out_requests
  FOR UPDATE TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- expenses
CREATE POLICY "Staff manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- purchase_orders / items
CREATE POLICY "Staff manage POs" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff manage PO items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- quotes / items
CREATE POLICY "Customers view own quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff manage quotes" ON public.quotes
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Customers view own quote items" ON public.quote_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND (q.user_id = auth.uid() OR private.has_any_staff_role(auth.uid()))));
CREATE POLICY "Staff manage quote items" ON public.quote_items
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- refunds / items
CREATE POLICY "Staff manage refunds" ON public.refunds
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff manage refund items" ON public.refund_items
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- stock_movements
CREATE POLICY "Staff view stock movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- suppliers
CREATE POLICY "Staff manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- vehicles
CREATE POLICY "Customers view own vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff manage vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

-- Restrict products SELECT to staff only (protects cost_price_pence)
DROP POLICY IF EXISTS "products read all authed" ON public.products;
CREATE POLICY "products read staff only" ON public.products
  FOR SELECT TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
