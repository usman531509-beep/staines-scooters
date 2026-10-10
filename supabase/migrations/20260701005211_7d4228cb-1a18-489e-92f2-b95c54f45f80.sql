
-- Add missing write policies for staff/admin operations
CREATE POLICY "sales write staff" ON public.sales FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

CREATE POLICY "vouchers write staff" ON public.vouchers FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

CREATE POLICY "offers write admin" ON public.offers FOR ALL TO authenticated
  USING (private.is_admin_or_owner(auth.uid()))
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

CREATE POLICY "settings write admin" ON public.loyalty_settings FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner(auth.uid()))
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

CREATE POLICY "loyalty_cards write staff" ON public.loyalty_cards FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (private.has_any_staff_role(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "point_txs write staff" ON public.point_transactions FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
