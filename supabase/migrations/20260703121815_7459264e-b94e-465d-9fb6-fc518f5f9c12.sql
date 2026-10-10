
CREATE POLICY "settings read authenticated"
  ON public.loyalty_settings FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON FUNCTION public.get_loyalty_settings() FROM PUBLIC, anon, authenticated;
