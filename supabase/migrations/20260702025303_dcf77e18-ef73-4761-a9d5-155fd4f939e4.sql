
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS offers_target_user_id_idx ON public.offers(target_user_id);

DROP POLICY IF EXISTS "all read active offers" ON public.offers;
CREATE POLICY "all read active offers" ON public.offers
FOR SELECT TO authenticated
USING (
  (active = true AND (target_user_id IS NULL OR target_user_id = auth.uid()))
  OR private.is_admin_or_owner(auth.uid())
);
