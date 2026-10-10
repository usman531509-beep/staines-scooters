
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS credit_amount_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_paid_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_status text;

CREATE INDEX IF NOT EXISTS sales_credit_outstanding_idx
  ON public.sales (user_id)
  WHERE credit_amount_pence > 0 AND (credit_amount_pence - credit_paid_pence) > 0;

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  method text NOT NULL DEFAULT 'stripe',
  stripe_session_id text,
  stripe_payment_intent text,
  status text NOT NULL DEFAULT 'succeeded',
  recorded_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_payments_sale_id_idx ON public.credit_payments (sale_id);
CREATE INDEX IF NOT EXISTS credit_payments_user_id_idx ON public.credit_payments (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS credit_payments_stripe_session_uniq
  ON public.credit_payments (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.credit_payments TO authenticated;
GRANT ALL ON public.credit_payments TO service_role;

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_payments_owner_read"
  ON public.credit_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_any_staff_role(auth.uid()));

CREATE POLICY "credit_payments_staff_insert"
  ON public.credit_payments FOR INSERT TO authenticated
  WITH CHECK (private.has_any_staff_role(auth.uid()));

CREATE POLICY "credit_payments_staff_update"
  ON public.credit_payments FOR UPDATE TO authenticated
  USING (private.has_any_staff_role(auth.uid()));

DROP TRIGGER IF EXISTS trg_credit_payments_updated_at ON public.credit_payments;
CREATE TRIGGER trg_credit_payments_updated_at
  BEFORE UPDATE ON public.credit_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_sale_credit_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id uuid;
  v_paid integer;
  v_owed integer;
BEGIN
  v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);
  SELECT COALESCE(SUM(amount_pence),0) INTO v_paid
    FROM public.credit_payments
    WHERE sale_id = v_sale_id AND status = 'succeeded';
  SELECT credit_amount_pence INTO v_owed FROM public.sales WHERE id = v_sale_id;
  IF v_owed IS NULL OR v_owed = 0 THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.sales
    SET credit_paid_pence = v_paid,
        credit_status = CASE
          WHEN v_paid >= v_owed THEN 'paid'
          WHEN v_paid > 0 THEN 'partial'
          ELSE 'unpaid'
        END
    WHERE id = v_sale_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_payments_recompute ON public.credit_payments;
CREATE TRIGGER trg_credit_payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_sale_credit_status();
