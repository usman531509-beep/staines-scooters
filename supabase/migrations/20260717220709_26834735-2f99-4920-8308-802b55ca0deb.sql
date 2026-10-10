CREATE OR REPLACE FUNCTION public.find_user_by_phone(_phone text)
RETURNS TABLE(id uuid, full_name text, short_code text, avatar_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
  last10 text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  digits := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF length(digits) < 7 THEN
    RETURN;
  END IF;
  -- Strip common UK country prefixes so 07..., +447..., 447..., 00447... all match.
  IF left(digits, 4) = '0044' THEN digits := substr(digits, 5); END IF;
  IF left(digits, 2) = '44'  AND length(digits) >= 11 THEN digits := substr(digits, 3); END IF;
  IF left(digits, 1) <> '0' AND length(digits) = 10 THEN digits := '0' || digits; END IF;
  last10 := right(digits, 10);
  RETURN QUERY
  SELECT p.id, p.full_name, p.short_code, p.avatar_url
  FROM public.profiles p
  WHERE p.phone IS NOT NULL
    AND right(regexp_replace(p.phone, '\D', '', 'g'), 10) = last10
    AND p.id <> auth.uid()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO authenticated;