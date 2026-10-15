-- Extra details from the public registration form (/register): date of birth,
-- vehicle registration and address. Kept in their own table so the till's
-- customer record (pos_customers: name, phone, email) stays as simple as before.
CREATE TABLE IF NOT EXISTS public.customer_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_customer_id uuid NOT NULL REFERENCES public.pos_customers(id) ON DELETE CASCADE,
  date_of_birth date,
  vehicle_reg text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customer_registrations_customer ON public.customer_registrations(pos_customer_id);
--> statement-breakpoint
ALTER TABLE public.customer_registrations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT ON public.customer_registrations TO authenticated;
--> statement-breakpoint
GRANT ALL ON public.customer_registrations TO service_role;
--> statement-breakpoint
-- Staff can read; only the server (service role) writes, from /api/public/register.
DROP POLICY IF EXISTS "Staff read customer registrations" ON public.customer_registrations;
--> statement-breakpoint
CREATE POLICY "Staff read customer registrations" ON public.customer_registrations
  FOR SELECT TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
