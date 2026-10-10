
-- Add a 4-digit short code to every customer profile for quick POS lookup.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS short_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_short_code_unique
  ON public.profiles (short_code)
  WHERE short_code IS NOT NULL;

-- Function to allocate a unique random 4-digit code.
CREATE OR REPLACE FUNCTION public.generate_profile_short_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    candidate := lpad((floor(random() * 10000))::int::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE short_code = candidate) THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 200 THEN
      RAISE EXCEPTION 'Unable to allocate unique 4-digit short_code';
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-fill short_code on insert if missing.
CREATE OR REPLACE FUNCTION public.assign_profile_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_profile_short_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_short_code ON public.profiles;
CREATE TRIGGER trg_profiles_assign_short_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_profile_short_code();

-- Backfill existing profiles that don't yet have a code.
DO $$
DECLARE
  r record;
  c text;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE short_code IS NULL LOOP
    c := public.generate_profile_short_code();
    UPDATE public.profiles SET short_code = c WHERE id = r.id;
  END LOOP;
END $$;
