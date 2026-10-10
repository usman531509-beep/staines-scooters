ALTER TABLE public.rental_customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rental_customers_user_id ON public.rental_customers(user_id);

-- Match a rental customer to an app profile by email or phone
CREATE OR REPLACE FUNCTION public.rental_match_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT p.id INTO m FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND (
        (NEW.email IS NOT NULL AND NEW.email <> '' AND lower(p.email) = lower(NEW.email))
        OR (NEW.phone IS NOT NULL AND NEW.phone <> '' AND regexp_replace(p.phone,'\D','','g') = regexp_replace(NEW.phone,'\D','','g'))
      )
    LIMIT 1;
    NEW.user_id := m;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_customers_match_profile ON public.rental_customers;
CREATE TRIGGER trg_rental_customers_match_profile
BEFORE INSERT OR UPDATE ON public.rental_customers
FOR EACH ROW EXECUTE FUNCTION public.rental_match_profile();

-- Keep rentals.customer_id in sync with the linked rental customer
CREATE OR REPLACE FUNCTION public.rental_sync_customer_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  IF NEW.customer_id IS NULL AND NEW.rental_customer_id IS NOT NULL THEN
    SELECT rc.user_id INTO m FROM public.rental_customers rc WHERE rc.id = NEW.rental_customer_id;
    NEW.customer_id := m;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rentals_sync_customer_id ON public.rentals;
CREATE TRIGGER trg_rentals_sync_customer_id
BEFORE INSERT OR UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.rental_sync_customer_id();

-- Backfill
UPDATE public.rental_customers rc SET user_id = p.id
FROM public.profiles p
WHERE rc.user_id IS NULL AND p.deleted_at IS NULL
  AND (
    (rc.email IS NOT NULL AND rc.email <> '' AND lower(p.email) = lower(rc.email))
    OR (rc.phone IS NOT NULL AND rc.phone <> '' AND regexp_replace(p.phone,'\D','','g') = regexp_replace(rc.phone,'\D','','g'))
  );

UPDATE public.rentals r SET customer_id = rc.user_id
FROM public.rental_customers rc
WHERE r.rental_customer_id = rc.id AND r.customer_id IS NULL AND rc.user_id IS NOT NULL;

-- Ownership helper
CREATE OR REPLACE FUNCTION public.rental_is_owner(_rental_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rentals r
    LEFT JOIN public.rental_customers rc ON rc.id = r.rental_customer_id
    WHERE r.id = _rental_id AND (r.customer_id = _uid OR rc.user_id = _uid)
  );
$$;

DROP POLICY IF EXISTS "Customers read own rental" ON public.rentals;
CREATE POLICY "Customers read own rental" ON public.rentals FOR SELECT TO authenticated
USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.rental_customers rc WHERE rc.id = rentals.rental_customer_id AND rc.user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers read own rental weeks" ON public.rental_weeks;
CREATE POLICY "Customers read own rental weeks" ON public.rental_weeks FOR SELECT TO authenticated
USING (public.rental_is_owner(rental_id, auth.uid()));

DROP POLICY IF EXISTS "Customers read own rental payments" ON public.rental_payments;
CREATE POLICY "Customers read own rental payments" ON public.rental_payments FOR SELECT TO authenticated
USING (public.rental_is_owner(rental_id, auth.uid()));

DROP POLICY IF EXISTS "Customers read own rental documents" ON public.rental_documents;
CREATE POLICY "Customers read own rental documents" ON public.rental_documents FOR SELECT TO authenticated
USING (public.rental_is_owner(rental_id, auth.uid()));

DROP POLICY IF EXISTS "Customers add own rental documents" ON public.rental_documents;
CREATE POLICY "Customers add own rental documents" ON public.rental_documents FOR INSERT TO authenticated
WITH CHECK (public.rental_is_owner(rental_id, auth.uid()));

DROP POLICY IF EXISTS "Customers read own rental pcns" ON public.rental_pcns;
CREATE POLICY "Customers read own rental pcns" ON public.rental_pcns FOR SELECT TO authenticated
USING (public.rental_is_owner(rental_id, auth.uid()));

-- Renters may read their own rental customer record
DROP POLICY IF EXISTS "Customers read own rental customer record" ON public.rental_customers;
CREATE POLICY "Customers read own rental customer record" ON public.rental_customers FOR SELECT TO authenticated
USING (user_id = auth.uid());