CREATE TABLE public.contact_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  bike text,
  reg text,
  service text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_enquiries_status_created ON public.contact_enquiries (status, created_at DESC);
-- The public form inserts through the server with the service role; staff only read and update.
GRANT SELECT, UPDATE, DELETE ON public.contact_enquiries TO authenticated;
GRANT ALL ON public.contact_enquiries TO service_role;
ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_enquiries_staff_read ON public.contact_enquiries FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));
CREATE POLICY contact_enquiries_staff_update ON public.contact_enquiries FOR UPDATE TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY contact_enquiries_admin_delete ON public.contact_enquiries FOR DELETE TO authenticated USING (public.is_rental_admin(auth.uid()));
