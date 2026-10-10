-- Settings singleton
CREATE TABLE public.rental_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  default_weekly_rate_pence integer NOT NULL DEFAULT 6000,
  default_deposit_pence integer NOT NULL DEFAULT 20000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.rental_settings TO authenticated;
GRANT ALL ON public.rental_settings TO service_role;
ALTER TABLE public.rental_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by authenticated" ON public.rental_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings writable by admin" ON public.rental_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin')));
INSERT INTO public.rental_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Bikes
CREATE TABLE public.rental_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  registration text NOT NULL,
  year integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX rental_bikes_reg_unique_active ON public.rental_bikes (lower(registration)) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_bikes TO authenticated;
GRANT ALL ON public.rental_bikes TO service_role;
ALTER TABLE public.rental_bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bikes readable by authenticated" ON public.rental_bikes FOR SELECT TO authenticated USING (true);
CREATE POLICY "bikes writable by staff" ON public.rental_bikes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- Rentals
CREATE TABLE public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id uuid REFERENCES public.rental_bikes(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date,
  weekly_rate_pence integer NOT NULL DEFAULT 6000,
  deposit_pence integer NOT NULL DEFAULT 20000,
  deposit_paid_pence integer NOT NULL DEFAULT 0,
  deposit_refunded_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  notes text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX rentals_customer_idx ON public.rentals(customer_id);
CREATE INDEX rentals_bike_idx ON public.rentals(bike_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rentals customer read own" ON public.rentals FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE POLICY "rentals staff write" ON public.rentals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- Documents
CREATE TABLE public.rental_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('driving_licence','cbt','proof_of_address','vehicle_insurance','other')),
  storage_path text NOT NULL,
  file_name text,
  expires_at date,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX rental_documents_rental_idx ON public.rental_documents(rental_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_documents TO authenticated;
GRANT ALL ON public.rental_documents TO service_role;
ALTER TABLE public.rental_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs read own or staff" ON public.rental_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rentals rt WHERE rt.id = rental_id AND (rt.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "docs insert staff or own" ON public.rental_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rentals rt WHERE rt.id = rental_id AND (rt.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "docs modify staff" ON public.rental_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE POLICY "docs delete staff" ON public.rental_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- Weeks
CREATE TABLE public.rental_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  days_charged integer NOT NULL CHECK (days_charged BETWEEN 0 AND 7),
  amount_pence integer NOT NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  paid_at timestamptz,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_id, week_start)
);
CREATE INDEX rental_weeks_rental_idx ON public.rental_weeks(rental_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_weeks TO authenticated;
GRANT ALL ON public.rental_weeks TO service_role;
ALTER TABLE public.rental_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weeks read own or staff" ON public.rental_weeks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rentals rt WHERE rt.id = rental_id AND (rt.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "weeks write staff" ON public.rental_weeks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- Payments
CREATE TABLE public.rental_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  week_id uuid REFERENCES public.rental_weeks(id) ON DELETE SET NULL,
  pcn_id uuid,
  amount_pence integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('weekly','deposit','deposit_refund','pcn','manual')),
  method text NOT NULL DEFAULT 'stripe' CHECK (method IN ('stripe','cash','card','bank_transfer','other')),
  stripe_session_id text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rental_payments_rental_idx ON public.rental_payments(rental_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT ALL ON public.rental_payments TO service_role;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments read own or staff" ON public.rental_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rentals rt WHERE rt.id = rental_id AND (rt.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "payments write staff" ON public.rental_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- PCNs
CREATE TABLE public.rental_pcns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  issued_on date NOT NULL,
  reference text,
  amount_pence integer NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding','paid','transferred_to_customer','disputed','void')),
  document_path text,
  notes text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX rental_pcns_rental_idx ON public.rental_pcns(rental_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_pcns TO authenticated;
GRANT ALL ON public.rental_pcns TO service_role;
ALTER TABLE public.rental_pcns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcns read own or staff" ON public.rental_pcns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rentals rt WHERE rt.id = rental_id AND (rt.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))));
CREATE POLICY "pcns write staff" ON public.rental_pcns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));

-- updated_at triggers
CREATE TRIGGER trg_rental_settings_updated BEFORE UPDATE ON public.rental_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rental_bikes_updated BEFORE UPDATE ON public.rental_bikes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rentals_updated BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rental_weeks_updated BEFORE UPDATE ON public.rental_weeks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rental_pcns_updated BEFORE UPDATE ON public.rental_pcns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for rental-documents (bucket already exists)
CREATE POLICY "rental-docs staff all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'rental-documents' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')))
  WITH CHECK (bucket_id = 'rental-documents' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE POLICY "rental-docs customer read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rental-documents' AND EXISTS (
    SELECT 1 FROM public.rentals rt WHERE rt.customer_id = auth.uid() AND position(rt.id::text in name) > 0
  ));
CREATE POLICY "rental-docs customer insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-documents' AND EXISTS (
    SELECT 1 FROM public.rentals rt WHERE rt.customer_id = auth.uid() AND position(rt.id::text in name) > 0
  ));
