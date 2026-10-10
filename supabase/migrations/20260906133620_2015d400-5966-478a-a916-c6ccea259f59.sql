CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  module text NOT NULL,
  action text NOT NULL,
  label text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read activity log"
ON public.activity_log FOR SELECT TO authenticated
USING (public.is_rental_admin(auth.uid()));

CREATE POLICY "staff write activity log"
ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = actor_id AND public.is_rental_staff(auth.uid()));

CREATE INDEX activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX activity_log_module_idx ON public.activity_log (module, created_at DESC);