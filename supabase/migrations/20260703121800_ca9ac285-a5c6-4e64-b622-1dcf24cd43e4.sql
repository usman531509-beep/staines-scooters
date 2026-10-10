
-- 1. Fix search_path on email queue functions (still SECURITY DEFINER; pgmq/cron live in named schemas)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';

-- Rewrite bodies to schema-qualify pgmq calls now that search_path is empty
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$$;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public.
-- These are internal (email queue + cash-out trigger). Keep get_loyalty_settings callable by authenticated.
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_cash_out_immutable_fields() FROM PUBLIC, anon, authenticated;

-- 3. Restrict voucher self-insert: only staff can create vouchers.
DROP POLICY IF EXISTS "own vouchers insert" ON public.vouchers;

-- 4. Cash-out request insert must not exceed the user's actual points balance,
-- and status must start as 'pending' (not pre-approved/paid).
CREATE OR REPLACE FUNCTION public.validate_cash_out_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance integer;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    -- staff-initiated inserts still go through this trigger; skip balance check for staff
    IF NOT private.has_any_staff_role(auth.uid()) THEN
      RAISE EXCEPTION 'cannot create cash-out request for another user';
    END IF;
    RETURN NEW;
  END IF;

  -- Force safe initial state for customer self-inserts
  NEW.status := 'pending';
  NEW.approved_by := NULL;
  NEW.paid_by := NULL;
  NEW.decided_at := NULL;
  NEW.paid_at := NULL;

  IF NEW.points IS NULL OR NEW.points <= 0 THEN
    RAISE EXCEPTION 'points must be positive';
  END IF;
  IF NEW.cash_value_pence IS NULL OR NEW.cash_value_pence < 0 THEN
    RAISE EXCEPTION 'cash_value_pence invalid';
  END IF;

  SELECT COALESCE(SUM(points_balance), 0) INTO v_balance
  FROM public.loyalty_cards
  WHERE user_id = NEW.user_id
    AND (NEW.card_id IS NULL OR id = NEW.card_id);

  -- Subtract points already tied up in pending cash-out requests
  v_balance := v_balance - COALESCE((
    SELECT SUM(points) FROM public.cash_out_requests
    WHERE user_id = NEW.user_id AND status = 'pending'
      AND (NEW.card_id IS NULL OR card_id = NEW.card_id)
  ), 0);

  IF NEW.points > v_balance THEN
    RAISE EXCEPTION 'requested points (%) exceed available balance (%)', NEW.points, v_balance;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cash_out_request_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_cash_out_request_insert ON public.cash_out_requests;
CREATE TRIGGER trg_validate_cash_out_request_insert
  BEFORE INSERT ON public.cash_out_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_cash_out_request_insert();

-- 5. Product images bucket: policy currently grants anon+authenticated read on a private bucket.
-- Since product images are intended to be public on the storefront, align policy with intent:
-- keep public read for the product-images bucket only (bucket is dedicated to public product photos).
-- Re-create the policy explicitly documenting scope; this is intentional public read.
DROP POLICY IF EXISTS "Anyone can read product images" ON storage.objects;
CREATE POLICY "Public read of product images bucket"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
