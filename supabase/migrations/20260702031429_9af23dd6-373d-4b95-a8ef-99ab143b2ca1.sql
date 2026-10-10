
-- Offers: add product_id and voucher_reward_name
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS voucher_reward_name TEXT;
CREATE INDEX IF NOT EXISTS offers_product_id_idx ON public.offers(product_id);

-- Offer progress: allow staff to insert/update
DROP POLICY IF EXISTS "progress write staff" ON public.offer_progress;
CREATE POLICY "progress write staff" ON public.offer_progress
  FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_progress TO authenticated;
GRANT ALL ON public.offer_progress TO service_role;

-- HMC voucher code sequence
CREATE SEQUENCE IF NOT EXISTS public.hmc_voucher_seq START 1001;

CREATE OR REPLACE FUNCTION public.next_hmc_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'HMC-' || lpad(nextval('public.hmc_voucher_seq')::text, 6, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_hmc_code() TO authenticated, service_role;
