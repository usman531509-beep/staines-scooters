-- The till tables were checked with hx_has_access(), a leftover stub that always
-- returns false, so no one could open a till. Use the same staff check as sales.
DROP POLICY IF EXISTS "Staff manage till sessions" ON public.till_sessions;
CREATE POLICY "Staff manage till sessions" ON public.till_sessions
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
--> statement-breakpoint
DROP POLICY IF EXISTS "Staff manage till cash movements" ON public.till_cash_movements;
CREATE POLICY "Staff manage till cash movements" ON public.till_cash_movements
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
