
-- 1. Reason enum
DO $$ BEGIN
  CREATE TYPE public.lost_damaged_reason AS ENUM ('lost','damaged','theft','expired','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE public.lost_damaged_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost_pence integer NOT NULL DEFAULT 0 CHECK (unit_cost_pence >= 0),
  total_cost_pence integer GENERATED ALWAYS AS ((unit_cost_pence * quantity)::integer) STORED,
  reason public.lost_damaged_reason NOT NULL DEFAULT 'damaged',
  notes text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX idx_lost_damaged_occurred ON public.lost_damaged_items (occurred_on DESC);
CREATE INDEX idx_lost_damaged_product ON public.lost_damaged_items (product_id);
CREATE INDEX idx_lost_damaged_deleted ON public.lost_damaged_items (deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_damaged_items TO authenticated;
GRANT ALL ON public.lost_damaged_items TO service_role;

-- 4. RLS
ALTER TABLE public.lost_damaged_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lost_damaged staff read" ON public.lost_damaged_items
  FOR SELECT TO authenticated
  USING (private.has_any_staff_role(auth.uid()));

CREATE POLICY "lost_damaged staff insert" ON public.lost_damaged_items
  FOR INSERT TO authenticated
  WITH CHECK (private.has_any_staff_role(auth.uid()));

CREATE POLICY "lost_damaged admin update" ON public.lost_damaged_items
  FOR UPDATE TO authenticated
  USING (private.is_admin_or_owner(auth.uid()))
  WITH CHECK (private.is_admin_or_owner(auth.uid()));

CREATE POLICY "lost_damaged admin delete" ON public.lost_damaged_items
  FOR DELETE TO authenticated
  USING (private.is_admin_or_owner(auth.uid()));

-- 5. updated_at trigger
CREATE TRIGGER trg_lost_damaged_updated
  BEFORE UPDATE ON public.lost_damaged_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Auto stock movement + decrement on insert
CREATE OR REPLACE FUNCTION public.lost_damaged_apply_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
      SET stock_qty = GREATEST(0, stock_qty - NEW.quantity::int)
      WHERE id = NEW.product_id;
    INSERT INTO public.stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
      VALUES (NEW.product_id, 'lost_damaged', -NEW.quantity, 'lost_damaged_items', NEW.id, NEW.reason::text, NEW.recorded_by);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lost_damaged_stock
  AFTER INSERT ON public.lost_damaged_items
  FOR EACH ROW EXECUTE FUNCTION public.lost_damaged_apply_stock();
