
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_rental_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('owner','admin','staff'));
$$;

CREATE OR REPLACE FUNCTION public.is_rental_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('owner','admin'));
$$;

-- settings (single row)
CREATE TABLE public.rental_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_weekly_rate_pence integer NOT NULL DEFAULT 6000,
  default_deposit_pence integer NOT NULL DEFAULT 20000,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rental_settings TO authenticated;
GRANT ALL ON public.rental_settings TO service_role;
ALTER TABLE public.rental_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read rental settings" ON public.rental_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rental settings" ON public.rental_settings FOR ALL TO authenticated USING (public.is_rental_admin(auth.uid())) WITH CHECK (public.is_rental_admin(auth.uid()));
CREATE TRIGGER trg_rental_settings_updated BEFORE UPDATE ON public.rental_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.rental_settings (id) VALUES (true);

-- bikes
CREATE TABLE public.rental_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL DEFAULT '',
  registration text NOT NULL,
  year integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_bikes TO authenticated;
GRANT ALL ON public.rental_bikes TO service_role;
ALTER TABLE public.rental_bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage bikes" ON public.rental_bikes FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Authenticated can read bikes" ON public.rental_bikes FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_rental_bikes_updated BEFORE UPDATE ON public.rental_bikes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- rentals
CREATE TABLE public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id uuid REFERENCES public.rental_bikes(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date,
  weekly_rate_pence integer NOT NULL DEFAULT 0,
  deposit_pence integer NOT NULL DEFAULT 0,
  deposit_paid_pence integer NOT NULL DEFAULT 0,
  deposit_refunded_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rentals" ON public.rentals FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Customers read own rental" ON public.rentals FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE TRIGGER trg_rentals_updated BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_rentals_customer ON public.rentals(customer_id);

-- weeks
CREATE TABLE public.rental_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  days_charged integer NOT NULL DEFAULT 7,
  amount_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_weeks TO authenticated;
GRANT ALL ON public.rental_weeks TO service_role;
ALTER TABLE public.rental_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rental weeks" ON public.rental_weeks FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Customers read own rental weeks" ON public.rental_weeks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));
CREATE TRIGGER trg_rental_weeks_updated BEFORE UPDATE ON public.rental_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payments
CREATE TABLE public.rental_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  week_id uuid REFERENCES public.rental_weeks(id) ON DELETE SET NULL,
  pcn_id uuid,
  amount_pence integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'weekly',
  method text NOT NULL DEFAULT 'cash',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  stripe_session_id text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT ALL ON public.rental_payments TO service_role;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rental payments" ON public.rental_payments FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Customers read own rental payments" ON public.rental_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));
CREATE TRIGGER trg_rental_payments_updated BEFORE UPDATE ON public.rental_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- documents
CREATE TABLE public.rental_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  expires_at date,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_documents TO authenticated;
GRANT ALL ON public.rental_documents TO service_role;
ALTER TABLE public.rental_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rental documents" ON public.rental_documents FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Customers read own rental documents" ON public.rental_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));
CREATE POLICY "Customers add own rental documents" ON public.rental_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));
CREATE TRIGGER trg_rental_documents_updated BEFORE UPDATE ON public.rental_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pcns
CREATE TABLE public.rental_pcns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  issued_on date NOT NULL,
  reference text,
  amount_pence integer NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'outstanding',
  document_path text,
  notes text,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_pcns TO authenticated;
GRANT ALL ON public.rental_pcns TO service_role;
ALTER TABLE public.rental_pcns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rental pcns" ON public.rental_pcns FOR ALL TO authenticated USING (public.is_rental_staff(auth.uid())) WITH CHECK (public.is_rental_staff(auth.uid()));
CREATE POLICY "Customers read own rental pcns" ON public.rental_pcns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));
CREATE TRIGGER trg_rental_pcns_updated BEFORE UPDATE ON public.rental_pcns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.rental_payments ADD CONSTRAINT rental_payments_pcn_fk FOREIGN KEY (pcn_id) REFERENCES public.rental_pcns(id) ON DELETE SET NULL;
