ALTER TABLE public.stock_adjustment_requests ADD COLUMN IF NOT EXISTS count_exclude_financial boolean NOT NULL DEFAULT true;
ALTER TABLE public.stock_adjustment_requests ADD COLUMN IF NOT EXISTS count_movement_type text NOT NULL DEFAULT 'adjustment';
CREATE TABLE public.stock_count_postings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), movement_id uuid NOT NULL UNIQUE REFERENCES public.stock_movements(id), exclude_financial boolean NOT NULL, physical_value_delta_pence bigint NOT NULL, inventory_delta_pence bigint NOT NULL, profit_delta_pence bigint NOT NULL, cash_delta_pence bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_count_postings TO authenticated;
GRANT ALL ON public.stock_count_postings TO service_role;
ALTER TABLE public.stock_count_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_count_postings_admin_read ON public.stock_count_postings FOR SELECT TO authenticated USING (public.is_rental_admin(auth.uid()));
CREATE FUNCTION public.capture_stock_count_posting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE excluded boolean; delta bigint;
BEGIN
 IF NEW.movement_type = 'count' THEN
  excluded := coalesce(nullif(current_setting('app.stock_count_exclude', true), '')::boolean, true);
 ELSIF NEW.movement_type = 'undo' THEN
  SELECT exclude_financial INTO excluded FROM public.stock_count_postings WHERE movement_id=NEW.reference_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
 ELSE RETURN NEW;
 END IF;
 delta := sign(NEW.quantity)::bigint * coalesce(NEW.cost_value_pence,0);
 INSERT INTO public.stock_count_postings(movement_id,exclude_financial,physical_value_delta_pence,inventory_delta_pence,profit_delta_pence) VALUES(NEW.id,excluded,delta,CASE WHEN excluded THEN 0 ELSE delta END,CASE WHEN excluded THEN 0 ELSE delta END);
 RETURN NEW;
END $$;
CREATE TRIGGER capture_stock_count_posting AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.capture_stock_count_posting();
CREATE TRIGGER stock_count_postings_immutable BEFORE UPDATE OR DELETE ON public.stock_count_postings FOR EACH ROW EXECUTE FUNCTION public.stock_movements_immutable();
CREATE FUNCTION public.post_stock_count(_product uuid,_batch uuid,_counted numeric,_expected numeric,_exclude_financial boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actual numeric; delta numeric; pv jsonb; a jsonb; val integer:=0; thr integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_rental_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorised'; END IF;
 IF _counted IS NULL OR _counted<0 OR _exclude_financial IS NULL THEN RAISE EXCEPTION 'Invalid stock count'; END IF;
 PERFORM 1 FROM public.products WHERE id=_product FOR UPDATE;
 PERFORM 1 FROM public.stock_batches WHERE product_id=_product FOR UPDATE;
 SELECT coalesce(sum(remaining_qty),0) INTO actual FROM public.stock_batches WHERE product_id=_product;
 IF actual IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Stock changed since this count was opened. Refresh and count again.'; END IF;
 delta:=_counted-actual;
 pv:=public.adjust_stock_preview(_product,_batch,delta);
 IF NOT (pv->>'ok')::boolean THEN RAISE EXCEPTION '%',pv->>'error'; END IF;
 FOR a IN SELECT * FROM jsonb_array_elements(pv->'allocations') LOOP val:=val+round((a->>'qty')::numeric*(a->>'cost_pence')::int)::int; END LOOP;
 SELECT approval_threshold_pence INTO thr FROM public.stock_settings WHERE id=1;
 IF thr IS NOT NULL AND val>thr AND NOT public.is_rental_admin(auth.uid()) THEN
 INSERT INTO public.stock_adjustment_requests(product_id,batch_id,qty_change,reason_type,reason,value_pence,requested_by,count_exclude_financial,count_movement_type) VALUES(_product,_batch,delta,'Stock Count Correction','Physical count: '||_counted||'; system: '||actual,val,auth.uid(),_exclude_financial,'count');
 RETURN jsonb_build_object('ok',true,'pending',true);
 END IF;
 PERFORM set_config('app.stock_count_exclude',_exclude_financial::text,true);
 RETURN public.adjust_stock_execute(_product,_batch,delta,'Stock Count Correction','Physical count: '||_counted||'; system: '||actual,NULL,auth.uid(),CASE WHEN public.is_rental_admin(auth.uid()) THEN auth.uid() ELSE NULL END,'count');
END $$;
REVOKE ALL ON FUNCTION public.post_stock_count(uuid,uuid,numeric,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.post_stock_count(uuid,uuid,numeric,numeric,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.decide_stock_adjustment(_id uuid,_approve boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; res jsonb;
BEGIN
 IF NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'Only owners and admins can approve'; END IF;
 SELECT * INTO r FROM public.stock_adjustment_requests WHERE id=_id AND status='pending' FOR UPDATE;
 IF r IS NULL THEN RAISE EXCEPTION 'Request not found or already decided'; END IF;
 IF _approve THEN
  PERFORM 1 FROM public.products WHERE id=r.product_id FOR UPDATE;
  PERFORM set_config('app.stock_count_exclude',r.count_exclude_financial::text,true);
  res:=public.adjust_stock_execute(r.product_id,r.batch_id,r.qty_change,r.reason_type,r.reason,r.evidence_path,r.requested_by,auth.uid(),r.count_movement_type);
 END IF;
 UPDATE public.stock_adjustment_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,decided_by=auth.uid(),decided_at=now() WHERE id=_id;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.stock_count_accounts(_from timestamptz,_to timestamptz) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE physical bigint; excluded_delta bigint; profit bigint; entries jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_rental_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorised'; END IF;
 SELECT coalesce(sum(round(remaining_qty*cost_pence)),0) INTO physical FROM public.stock_batches;
 SELECT coalesce(sum(physical_value_delta_pence),0) INTO excluded_delta FROM public.stock_count_postings WHERE exclude_financial;
 SELECT coalesce(sum(profit_delta_pence),0) INTO profit FROM public.stock_count_postings WHERE created_at>=_from AND created_at<=_to;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'created_at',p.created_at,'product',pr.name,'inventoryDeltaPence',p.inventory_delta_pence,'profitDeltaPence',p.profit_delta_pence,'kind',m.movement_type) ORDER BY p.created_at DESC),'[]'::jsonb) INTO entries FROM public.stock_count_postings p JOIN public.stock_movements m ON m.id=p.movement_id JOIN public.products pr ON pr.id=m.product_id WHERE NOT p.exclude_financial AND p.created_at>=_from AND p.created_at<=_to;
 RETURN jsonb_build_object('profitDeltaPence',profit,'inventoryAssetPence',physical-excluded_delta,'cashDeltaPence',0,'entries',entries);
END $$;
REVOKE ALL ON FUNCTION public.stock_count_accounts(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stock_count_accounts(timestamptz,timestamptz) TO authenticated;