ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS sale_price_pence integer;

CREATE TABLE public.stock_movement_undos (
  movement_id uuid PRIMARY KEY,
  undo_movement_id uuid,
  reason text,
  undone_by uuid,
  undone_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movement_undos TO authenticated;
GRANT ALL ON public.stock_movement_undos TO service_role;
ALTER TABLE public.stock_movement_undos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read stock undos" ON public.stock_movement_undos FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.receive_stock_v2(_product uuid, _qty numeric, _cost_pence integer, _sale_price_pence integer, _make_live boolean, _supplier text, _reference text, _received date, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bid uuid;
BEGIN
  bid := public.receive_stock(_product, _qty, _cost_pence, _supplier, _reference, _received, _notes);
  UPDATE public.stock_batches SET sale_price_pence = _sale_price_pence WHERE id = bid;
  IF coalesce(_make_live,false) AND _sale_price_pence IS NOT NULL THEN
    UPDATE public.products SET retail_price_pence = _sale_price_pence, cost_price_pence = coalesce(_cost_pence, cost_price_pence) WHERE id = _product;
  END IF;
  RETURN bid;
END $$;

CREATE OR REPLACE FUNCTION public.undo_stock_movement(_movement uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m record; b record; before_total numeric; q numeric; nid uuid;
BEGIN
  IF NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can undo stock activity'; END IF;
  SELECT * INTO m FROM public.stock_movements WHERE id = _movement;
  IF m IS NULL THEN RAISE EXCEPTION 'Activity not found'; END IF;
  IF m.movement_type IN ('sale','undo') THEN RAISE EXCEPTION 'Sales and undo entries cannot be undone here'; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movement_undos WHERE movement_id = _movement) THEN RAISE EXCEPTION 'Already undone'; END IF;
  IF m.batch_id IS NULL THEN RAISE EXCEPTION 'This activity has no batch to reverse'; END IF;
  SELECT * INTO b FROM public.stock_batches WHERE id = m.batch_id FOR UPDATE;
  q := -m.quantity;
  IF b.remaining_qty + q < 0 THEN RAISE EXCEPTION 'Cannot undo: only % left in batch %. Stock can never go below zero.', b.remaining_qty, b.batch_code; END IF;
  SELECT coalesce(sum(remaining_qty),0) INTO before_total FROM public.stock_batches WHERE product_id = m.product_id;
  UPDATE public.stock_batches SET remaining_qty = remaining_qty + q,
    status = CASE WHEN status = 'archived' THEN status WHEN remaining_qty + q <= 0 THEN 'sold_out' ELSE 'active' END WHERE id = b.id;
  INSERT INTO public.stock_movements (product_id, batch_id, movement_type, quantity, qty_before, qty_after, reason_type, reason, cost_value_pence, retail_value_pence, approval_status, created_by, reference_type, reference_id)
    VALUES (m.product_id, m.batch_id, 'undo', q, before_total, before_total + q, 'Undo', coalesce(nullif(_reason,''),'Undone'), m.cost_value_pence, m.retail_value_pence, 'auto', auth.uid(), 'stock_movement_undo', m.id)
    RETURNING id INTO nid;
  INSERT INTO public.stock_movement_undos (movement_id, undo_movement_id, reason, undone_by) VALUES (m.id, nid, nullif(_reason,''), auth.uid());
  UPDATE public.products SET stock_qty = greatest(0, round(coalesce(stock_qty,0) + q)::int) WHERE id = m.product_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.set_stock_batch_archived(_batch uuid, _archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can archive batches'; END IF;
  IF _archived AND EXISTS (SELECT 1 FROM public.stock_batches WHERE id = _batch AND remaining_qty > 0) THEN
    RAISE EXCEPTION 'Only sold-out batches can be moved to the recycle bin';
  END IF;
  UPDATE public.stock_batches SET status = CASE WHEN _archived THEN 'archived' WHEN remaining_qty > 0 THEN 'active' ELSE 'sold_out' END WHERE id = _batch;
END $$;

CREATE OR REPLACE FUNCTION public.products_opening_batch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bid uuid;
BEGIN
  IF coalesce(NEW.is_service,false) OR coalesce(NEW.stock_qty,0) <= 0 THEN RETURN NEW; END IF;
  INSERT INTO public.stock_batches (product_id, batch_code, received_at, opening_qty, remaining_qty, cost_pence, sale_price_pence, reference, notes)
    VALUES (NEW.id, 'B' || to_char(current_date,'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)), current_date, NEW.stock_qty, NEW.stock_qty, coalesce(NEW.cost_price_pence,0), NEW.retail_price_pence, 'Opening balance', 'Opening balance')
    RETURNING id INTO bid;
  INSERT INTO public.stock_movements (product_id, batch_id, movement_type, quantity, qty_before, qty_after, reason_type, reason, cost_value_pence, retail_value_pence, approval_status, reference_type, reference_id)
    VALUES (NEW.id, bid, 'receive', NEW.stock_qty, 0, NEW.stock_qty, 'Receive stock', 'Opening balance', NEW.stock_qty * coalesce(NEW.cost_price_pence,0), NEW.stock_qty * coalesce(NEW.retail_price_pence,0), 'auto', 'stock_batch', bid);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_products_opening_batch AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_opening_batch();

INSERT INTO public.stock_batches (product_id, batch_code, received_at, opening_qty, remaining_qty, cost_pence, sale_price_pence, reference, notes)
SELECT p.id, 'B' || to_char(current_date,'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)), current_date, p.stock_qty, p.stock_qty, coalesce(p.cost_price_pence,0), p.retail_price_pence, 'Legacy opening balance', 'Legacy opening balance'
FROM public.products p
WHERE p.deleted_at IS NULL AND NOT coalesce(p.is_service,false) AND coalesce(p.stock_qty,0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.stock_batches b WHERE b.product_id = p.id);