
-- New offer types (must be committed before use)
ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'percent_off_product';
ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'fixed_off_product';

-- Bundle offers can span multiple products
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS product_ids uuid[];

-- Track offer redemptions
CREATE TABLE IF NOT EXISTS public.offer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  offer_name text NOT NULL,
  offer_type public.offer_type NOT NULL,
  savings_pence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.offer_redemptions TO authenticated;
GRANT ALL ON public.offer_redemptions TO service_role;

ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own offer redemptions"
  ON public.offer_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_any_staff_role(auth.uid()));

CREATE POLICY "staff write offer redemptions"
  ON public.offer_redemptions FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

CREATE INDEX IF NOT EXISTS offer_redemptions_user_idx ON public.offer_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offer_redemptions_offer_idx ON public.offer_redemptions (offer_id, created_at DESC);
