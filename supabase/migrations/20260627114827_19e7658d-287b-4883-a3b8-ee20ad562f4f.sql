
-- 1. Restrict EXECUTE on has_role: only service_role can call directly.
-- RLS policies invoke it under the policy owner's privileges, so authenticated
-- users do NOT need direct EXECUTE for has_role() inside policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. user_roles: explicit admin/owner-only write policies.
DROP POLICY IF EXISTS "Only owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only owners can delete roles" ON public.user_roles;

CREATE POLICY "Only owners can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 3. cash_out_requests: explicit staff-only update/delete policies.
DROP POLICY IF EXISTS "Staff can update cash out requests" ON public.cash_out_requests;
DROP POLICY IF EXISTS "Staff can delete cash out requests" ON public.cash_out_requests;

CREATE POLICY "Staff can update cash out requests"
  ON public.cash_out_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Staff can delete cash out requests"
  ON public.cash_out_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
