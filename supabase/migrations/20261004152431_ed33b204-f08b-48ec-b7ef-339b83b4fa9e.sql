
CREATE TABLE public.stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_code text NOT NULL,
  received_at date NOT NULL DEFAULT current_date,
  opening_qty numeric NOT NULL CHECK (opening_qty >= 0),
  remaining_qty numeric NOT NULL CHECK (remaining_qty >= 0),
  cost_pence integer NOT NULL DEFAULT 0,
  supplier text, reference text, notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_batches TO authenticated;
GRANT ALL ON public.stock_batches TO service_role;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read batches" ON public.stock_batches FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));
CREATE INDEX stock_batches_product_idx ON public.stock_batches(product_id, received_at, created_at);
CREATE TRIGGER stock_batches_updated BEFORE UPDATE ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.stock_batches(id),
  ADD COLUMN IF NOT EXISTS qty_before numeric,
  ADD COLUMN IF NOT EXISTS qty_after numeric,
  ADD COLUMN IF NOT EXISTS reason_type text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS cost_value_pence integer,
  ADD COLUMN IF NOT EXISTS retail_value_pence integer,
  ADD COLUMN IF NOT EXISTS evidence_path text,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE OR REPLACE FUNCTION public.stock_movements_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Stock movements are permanent and cannot be changed'; END $$;
CREATE TRIGGER stock_movements_no_change BEFORE UPDATE OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.stock_movements_immutable();

CREATE TABLE public.stock_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  approval_threshold_pence integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.stock_settings (id) VALUES (1);
GRANT SELECT ON public.stock_settings TO authenticated;
GRANT ALL ON public.stock_settings TO service_role;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read stock settings" ON public.stock_settings FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));

CREATE TABLE public.stock_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid REFERENCES public.stock_batches(id),
  qty_change numeric NOT NULL,
  reason_type text NOT NULL,
  reason text,
  evidence_path text,
  value_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_adjustment_requests TO authenticated;
GRANT ALL ON public.stock_adjustment_requests TO service_role;
ALTER TABLE public.stock_adjustment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read adjustment requests" ON public.stock_adjustment_requests FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));

-- FIFO allocation preview: returns list of {batch_id, batch_code, qty, cost_pence}
CREATE OR REPLACE FUNCTION public.adjust_stock_preview(_product uuid, _batch uuid, _delta numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE need numeric := abs(_delta); b record; take numeric; res jsonb := '[]'::jsonb; total numeric;
BEGIN
  IF NOT public.is_rental_staff(auth.uid()) AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'not authorised'; END IF;
  IF _delta = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Quantity must not be zero'); END IF;
  IF _delta > 0 THEN
    SELECT * INTO b FROM public.stock_batches WHERE product_id = _product AND (_batch IS NULL OR id = _batch)
      ORDER BY received_at DESC, created_at DESC LIMIT 1;
    IF b IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'This product has never had a delivery. Use Receive stock first.'); END IF;
    RETURN jsonb_build_object('ok', true, 'allocations', jsonb_build_array(jsonb_build_object('batch_id', b.id, 'batch_code', b.batch_code, 'qty', need, 'cost_pence', b.cost_pence)));
  END IF;
  SELECT coalesce(sum(remaining_qty),0) INTO total FROM public.stock_batches WHERE product_id = _product AND (_batch IS NULL OR id = _batch);
  IF total < need THEN RETURN jsonb_build_object('ok', false, 'error', 'Not enough stock: only ' || total || ' available. Nothing was changed.'); END IF;
  FOR b IN SELECT * FROM public.stock_batches WHERE product_id = _product AND (_batch IS NULL OR id = _batch) AND remaining_qty > 0
      ORDER BY received_at, created_at LOOP
    EXIT WHEN need <= 0;
    take := least(need, b.remaining_qty);
    res := res || jsonb_build_object('batch_id', b.id, 'batch_code', b.batch_code, 'qty', take, 'cost_pence', b.cost_pence);
    need := need - take;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'allocations', res);
END $$;

-- Applies an adjustment (all or nothing)
CREATE OR REPLACE FUNCTION public.adjust_stock_execute(_product uuid, _batch uuid, _delta numeric, _reason_type text, _reason text, _evidence text, _user uuid, _approved_by uuid, _movement_type text DEFAULT 'adjustment')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pv jsonb; a jsonb; q numeric; before_total numeric; running numeric; price int; total_cost int := 0;
BEGIN
  pv := public.adjust_stock_preview(_product, _batch, _delta);
  IF NOT (pv->>'ok')::boolean THEN RAISE EXCEPTION '%', pv->>'error'; END IF;
  SELECT coalesce(sum(remaining_qty),0) INTO before_total FROM public.stock_batches WHERE product_id = _product;
  SELECT retail_price_pence INTO price FROM public.products WHERE id = _product;
  running := before_total;
  FOR a IN SELECT * FROM jsonb_array_elements(pv->'allocations') LOOP
    q := (a->>'qty')::numeric * sign(_delta);
    UPDATE public.stock_batches SET remaining_qty = remaining_qty + q,
      opening_qty = CASE WHEN q > 0 THEN opening_qty ELSE opening_qty END,
      status = CASE WHEN remaining_qty + q <= 0 THEN 'sold_out' ELSE 'active' END
      WHERE id = (a->>'batch_id')::uuid;
    INSERT INTO public.stock_movements (product_id, batch_id, movement_type, quantity, qty_before, qty_after, reason_type, reason, cost_value_pence, retail_value_pence, evidence_path, approval_status, approved_by, created_by, reference_type)
    VALUES (_product, (a->>'batch_id')::uuid, _movement_type, q, running, running + q, _reason_type, coalesce(nullif(_reason,''), _reason_type),
      round(abs(q) * (a->>'cost_pence')::int)::int, round(abs(q) * coalesce(price,0))::int, _evidence,
      CASE WHEN _approved_by IS NULL THEN 'auto' ELSE 'approved' END, coalesce(_approved_by, _user), _user, 'stock_adjustment');
    running := running + q;
    total_cost := total_cost + round(abs(q) * (a->>'cost_pence')::int)::int;
  END LOOP;
  UPDATE public.products SET stock_qty = greatest(0, round(coalesce(stock_qty,0) + _delta)::int) WHERE id = _product;
  RETURN jsonb_build_object('ok', true, 'applied', true, 'cost_value_pence', total_cost, 'qty_before', before_total, 'qty_after', running);
END $$;

CREATE OR REPLACE FUNCTION public.adjust_stock(_product uuid, _batch uuid, _delta numeric, _reason_type text, _reason text, _evidence text, _movement_type text DEFAULT 'adjustment')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pv jsonb; a jsonb; val int := 0; thr int; uid uuid := auth.uid();
BEGIN
  IF NOT public.is_rental_staff(uid) THEN RAISE EXCEPTION 'not authorised'; END IF;
  pv := public.adjust_stock_preview(_product, _batch, _delta);
  IF NOT (pv->>'ok')::boolean THEN RAISE EXCEPTION '%', pv->>'error'; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(pv->'allocations') LOOP
    val := val + round((a->>'qty')::numeric * (a->>'cost_pence')::int)::int;
  END LOOP;
  SELECT approval_threshold_pence INTO thr FROM public.stock_settings WHERE id = 1;
  IF thr IS NOT NULL AND val > thr AND NOT public.is_rental_admin(uid) THEN
    INSERT INTO public.stock_adjustment_requests (product_id, batch_id, qty_change, reason_type, reason, evidence_path, value_pence, requested_by)
      VALUES (_product, _batch, _delta, _reason_type, _reason, _evidence, val, uid);
    RETURN jsonb_build_object('ok', true, 'pending', true, 'value_pence', val);
  END IF;
  RETURN public.adjust_stock_execute(_product, _batch, _delta, _reason_type, _reason, _evidence, uid,
    CASE WHEN public.is_rental_admin(uid) THEN uid ELSE NULL END, _movement_type);
END $$;

CREATE OR REPLACE FUNCTION public.decide_stock_adjustment(_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; res jsonb;
BEGIN
  IF NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'Only owners and admins can approve'; END IF;
  SELECT * INTO r FROM public.stock_adjustment_requests WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request not found or already decided'; END IF;
  IF _approve THEN
    res := public.adjust_stock_execute(r.product_id, r.batch_id, r.qty_change, r.reason_type, r.reason, r.evidence_path, r.requested_by, auth.uid());
  END IF;
  UPDATE public.stock_adjustment_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, decided_by = auth.uid(), decided_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.set_stock_approval_threshold(_pence integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'Only owners and admins can change this'; END IF;
  UPDATE public.stock_settings SET approval_threshold_pence = _pence, updated_at = now() WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.receive_stock(_product uuid, _qty numeric, _cost_pence integer, _supplier text, _reference text, _received date, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bid uuid; before_total numeric; code text; price int;
BEGIN
  IF NOT public.is_rental_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorised'; END IF;
  IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be more than zero'; END IF;
  SELECT coalesce(sum(remaining_qty),0) INTO before_total FROM public.stock_batches WHERE product_id = _product;
  code := 'B' || to_char(coalesce(_received, current_date), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  INSERT INTO public.stock_batches (product_id, batch_code, received_at, opening_qty, remaining_qty, cost_pence, supplier, reference, notes, created_by)
    VALUES (_product, code, coalesce(_received, current_date), _qty, _qty, coalesce(_cost_pence,0), nullif(_supplier,''), nullif(_reference,''), nullif(_notes,''), auth.uid())
    RETURNING id INTO bid;
  SELECT retail_price_pence INTO price FROM public.products WHERE id = _product;
  INSERT INTO public.stock_movements (product_id, batch_id, movement_type, quantity, qty_before, qty_after, reason_type, reason, cost_value_pence, retail_value_pence, approval_status, created_by, reference_type, reference_id)
    VALUES (_product, bid, 'receive', _qty, before_total, before_total + _qty, 'Receive stock', coalesce(nullif(_reference,''),'Delivery received'), round(_qty*coalesce(_cost_pence,0))::int, round(_qty*coalesce(price,0))::int, 'auto', auth.uid(), 'stock_batch', bid);
  UPDATE public.products SET stock_qty = coalesce(stock_qty,0) + round(_qty)::int WHERE id = _product;
  RETURN bid;
END $$;

-- Sales take stock from oldest batches first (products.stock_qty handled by the till already)
CREATE OR REPLACE FUNCTION public.sale_item_consume_batches() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE need numeric; b record; take numeric; running numeric; price int;
BEGIN
  IF NEW.product_id IS NULL OR coalesce(NEW.is_service,false) OR coalesce(NEW.qty,0) <= 0 THEN RETURN NEW; END IF;
  SELECT coalesce(sum(remaining_qty),0) INTO running FROM public.stock_batches WHERE product_id = NEW.product_id;
  IF running <= 0 THEN RETURN NEW; END IF;
  need := NEW.qty;
  FOR b IN SELECT * FROM public.stock_batches WHERE product_id = NEW.product_id AND remaining_qty > 0 ORDER BY received_at, created_at FOR UPDATE LOOP
    EXIT WHEN need <= 0;
    take := least(need, b.remaining_qty);
    UPDATE public.stock_batches SET remaining_qty = remaining_qty - take, status = CASE WHEN remaining_qty - take <= 0 THEN 'sold_out' ELSE status END WHERE id = b.id;
    INSERT INTO public.stock_movements (product_id, batch_id, movement_type, quantity, qty_before, qty_after, reason_type, reason, cost_value_pence, retail_value_pence, approval_status, reference_type, reference_id)
      VALUES (NEW.product_id, b.id, 'sale', -take, running, running - take, 'Sale', 'Sold', round(take*b.cost_pence)::int, round(take*coalesce(NEW.unit_price_pence,0))::int, 'auto', 'sale', NEW.sale_id);
    running := running - take; need := need - take;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sale_items_consume_batches AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.sale_item_consume_batches();

REVOKE EXECUTE ON FUNCTION public.adjust_stock_execute(uuid,uuid,numeric,text,text,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sale_item_consume_batches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_preview(uuid,uuid,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid,uuid,numeric,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_stock_adjustment(uuid,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_stock_approval_threshold(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.receive_stock(uuid,numeric,integer,text,text,date,text) FROM anon;

CREATE POLICY "Staff upload stock evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stock-evidence' AND public.is_rental_staff(auth.uid()));
CREATE POLICY "Staff read stock evidence" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stock-evidence' AND public.is_rental_staff(auth.uid()));
