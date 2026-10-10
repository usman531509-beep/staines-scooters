CREATE TABLE public.pos_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  phone text NOT NULL CHECK (length(btrim(phone)) > 0),
  email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_pos_customers_name ON public.pos_customers (lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_pos_customers_phone ON public.pos_customers (phone) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.pos_customers TO authenticated;
GRANT ALL ON public.pos_customers TO service_role;
ALTER TABLE public.pos_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_customers_staff_read ON public.pos_customers FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));
CREATE POLICY pos_customers_staff_insert ON public.pos_customers FOR INSERT TO authenticated WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY pos_customers_staff_update ON public.pos_customers FOR UPDATE TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS pos_customer_id uuid REFERENCES public.pos_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_pos_customer ON public.sales (pos_customer_id) WHERE pos_customer_id IS NOT NULL;
