CREATE TABLE public.staff_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pos boolean NOT NULL DEFAULT true,
  sales boolean NOT NULL DEFAULT false,
  products boolean NOT NULL DEFAULT false,
  categories boolean NOT NULL DEFAULT false,
  refunds boolean NOT NULL DEFAULT false,
  expenses boolean NOT NULL DEFAULT false,
  reports boolean NOT NULL DEFAULT false,
  customers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or admin" ON public.staff_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "admin manage" ON public.staff_permissions
  FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'owner'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'owner'::app_role)
  );

CREATE TRIGGER staff_permissions_set_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.staff_permissions (user_id, pos)
SELECT DISTINCT user_id, true FROM public.user_roles WHERE role = 'staff'
ON CONFLICT (user_id) DO NOTHING;