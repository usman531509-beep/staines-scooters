CREATE TABLE public.rental_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  date_of_birth date,
  address text,
  licence_number text,
  email text,
  phone text,
  photo_path text,
  notes text,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_customers TO authenticated;
GRANT ALL ON public.rental_customers TO service_role;

ALTER TABLE public.rental_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage rental customers" ON public.rental_customers
  FOR ALL TO authenticated
  USING (public.is_rental_staff(auth.uid()))
  WITH CHECK (public.is_rental_staff(auth.uid()));

CREATE TRIGGER trg_rental_customers_updated_at
  BEFORE UPDATE ON public.rental_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rental_customers_name ON public.rental_customers (full_name);

ALTER TABLE public.rentals ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.rentals ADD COLUMN rental_customer_id uuid REFERENCES public.rental_customers(id) ON DELETE SET NULL;
CREATE INDEX idx_rentals_rental_customer ON public.rentals (rental_customer_id);