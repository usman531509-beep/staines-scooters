
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read all authed" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories write staff" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text UNIQUE,
  barcode text UNIQUE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  cost_price_pence integer NOT NULL DEFAULT 0 CHECK (cost_price_pence >= 0),
  retail_price_pence integer NOT NULL DEFAULT 0 CHECK (retail_price_pence >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  stock_qty integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  is_service boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_active_idx ON public.products(is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read all authed" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "products write staff" ON public.products
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales
  ALTER COLUMN card_id DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subtotal_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS receipt_no bigserial;

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  qty numeric(10,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price_pence integer NOT NULL CHECK (unit_price_pence >= 0),
  discount_pence integer NOT NULL DEFAULT 0 CHECK (discount_pence >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  line_total_pence integer NOT NULL CHECK (line_total_pence >= 0),
  is_service boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items read own or staff" ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    private.has_any_staff_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );
CREATE POLICY "sale_items write staff" ON public.sale_items
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

INSERT INTO public.categories (name, sort_order) VALUES
  ('Labour', 1),('Servicing', 2),('Oils & Fluids', 3),('Brakes', 4),('Tyres', 5),
  ('Chains & Sprockets', 6),('Batteries', 7),('Bulbs & Electrical', 8),('Filters', 9),('Accessories', 10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, sku, category_id, cost_price_pence, retail_price_pence, vat_rate, stock_qty, min_stock, is_service)
SELECT v.name, v.sku, c.id, v.cost, v.retail, v.vat, v.qty, v.minq, v.service
FROM (VALUES
  ('Labour - 1 hour',          'LAB-1H',  'Labour',             0,     6000, 20::numeric, 0,  0, true),
  ('Labour - 30 min',          'LAB-30M', 'Labour',             0,     3500, 20::numeric, 0,  0, true),
  ('Minor Service',            'SRV-MIN', 'Servicing',          0,     8500, 20::numeric, 0,  0, true),
  ('Major Service',            'SRV-MAJ', 'Servicing',          0,    16500, 20::numeric, 0,  0, true),
  ('MOT Test',                 'MOT',     'Servicing',          0,     2965,  0::numeric, 0,  0, true),
  ('10W-40 Engine Oil 1L',     'OIL-1040','Oils & Fluids',      650,   1495, 20::numeric, 24, 6, false),
  ('Brake Fluid DOT 4 500ml',  'BF-DOT4', 'Oils & Fluids',      280,    795, 20::numeric, 18, 4, false),
  ('Front Brake Pads',         'BP-FRT',  'Brakes',             1200,  3495, 20::numeric, 10, 3, false),
  ('Rear Brake Pads',          'BP-REAR', 'Brakes',             1100,  2995, 20::numeric, 8,  3, false),
  ('Tyre 110/70-17 Front',     'TYR-F17', 'Tyres',              4200,  7995, 20::numeric, 6,  2, false),
  ('Tyre 130/70-17 Rear',      'TYR-R17', 'Tyres',              5200,  9495, 20::numeric, 6,  2, false),
  ('Chain & Sprocket Kit 525', 'CSK-525', 'Chains & Sprockets', 4500, 11995, 20::numeric, 4,  2, false),
  ('12V Battery YTX9-BS',      'BAT-YTX9','Batteries',          3200,  6495, 20::numeric, 5,  2, false),
  ('Headlight Bulb H4',        'BLB-H4',  'Bulbs & Electrical', 350,    995, 20::numeric, 12, 4, false),
  ('Oil Filter Standard',      'FLT-OIL', 'Filters',            300,    895, 20::numeric, 20, 6, false),
  ('Air Filter Standard',      'FLT-AIR', 'Filters',            450,   1395, 20::numeric, 14, 4, false),
  ('Chain Lube 400ml',         'ACC-LUBE','Accessories',        320,    795, 20::numeric, 22, 6, false)
) AS v(name,sku,catname,cost,retail,vat,qty,minq,service)
JOIN public.categories c ON c.name = v.catname
ON CONFLICT (sku) DO NOTHING;
