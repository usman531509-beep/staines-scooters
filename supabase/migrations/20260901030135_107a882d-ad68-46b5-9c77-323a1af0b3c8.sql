CREATE TABLE IF NOT EXISTS public.product_title_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_title_presets_uniq ON public.product_title_presets (product_id, lower(title));
CREATE INDEX IF NOT EXISTS product_title_presets_product_idx ON public.product_title_presets (product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_title_presets TO authenticated;
GRANT ALL ON public.product_title_presets TO service_role;
ALTER TABLE public.product_title_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "title presets read staff only" ON public.product_title_presets;
DROP POLICY IF EXISTS "title presets write staff" ON public.product_title_presets;
CREATE POLICY "title presets read staff only" ON public.product_title_presets FOR SELECT TO authenticated USING (private.has_any_staff_role(auth.uid()));
CREATE POLICY "title presets write staff" ON public.product_title_presets FOR ALL TO authenticated USING (private.has_any_staff_role(auth.uid())) WITH CHECK (private.has_any_staff_role(auth.uid()));