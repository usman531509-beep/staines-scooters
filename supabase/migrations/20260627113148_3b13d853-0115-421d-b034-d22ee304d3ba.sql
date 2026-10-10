
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ PHASE 2 ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text, email text, phone text, address text, notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal_pence integer NOT NULL DEFAULT 0,
  tax_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  order_date date, expected_date date, received_date date, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage POs" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL, sku text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_cost_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  received_qty numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PO items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  reference_type text, reference_id uuid, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view stock movements" ON public.stock_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

-- ============ PHASE 3 ============
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registration text NOT NULL,
  make text, model text, year integer, colour text, vin text,
  mileage integer, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "Staff manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_vehicles_user ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_reg ON public.vehicles(registration);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  service_type text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  customer_name text, customer_phone text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own appts" ON public.appointments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "Staff manage appts" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_appt_scheduled ON public.appointments(scheduled_at);

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_name text, customer_phone text, customer_email text,
  status text NOT NULL DEFAULT 'draft',
  subtotal_pence integer NOT NULL DEFAULT 0,
  discount_pence integer NOT NULL DEFAULT 0,
  tax_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  expires_at date, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own quotes" ON public.quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "Staff manage quotes" ON public.quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL, sku text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price_pence integer NOT NULL DEFAULT 0,
  discount_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own quote items" ON public.quote_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.user_id = auth.uid() OR public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role)))
  );
CREATE POLICY "Staff manage quote items" ON public.quote_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- ============ PHASE 4 ============
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text NOT NULL UNIQUE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  amount_pence integer NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  reason text, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage refunds" ON public.refunds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

CREATE TABLE public.refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  amount_pence integer NOT NULL DEFAULT 0,
  return_to_stock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_items TO authenticated;
GRANT ALL ON public.refund_items TO service_role;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage refund items" ON public.refund_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  vendor text, description text,
  amount_pence integer NOT NULL,
  tax_pence integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'card',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'staff'::app_role) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);

INSERT INTO public.suppliers (name, contact_name, phone, email) VALUES
  ('Motul UK', 'Sales Team', '+44 1234 567890', 'sales@motul.co.uk'),
  ('Michelin Moto', 'Trade Desk', '+44 1234 567891', 'trade@michelin.co.uk'),
  ('EBC Brakes', 'Trade', '+44 1234 567892', 'orders@ebcbrakes.co.uk');
