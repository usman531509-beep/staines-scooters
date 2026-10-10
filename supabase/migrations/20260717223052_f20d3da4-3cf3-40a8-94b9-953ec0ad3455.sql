
CREATE OR REPLACE FUNCTION public.get_admin_contacts()
RETURNS TABLE(id uuid, full_name text, short_code text, phone text, avatar_url text, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.id)
    p.id, p.full_name, p.short_code, p.phone, p.avatar_url,
    (SELECT ur2.role::text FROM public.user_roles ur2
      WHERE ur2.user_id = p.id
      ORDER BY CASE ur2.role::text WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
      LIMIT 1) AS role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role::text IN ('owner','admin')
    AND auth.uid() IS NOT NULL
  ORDER BY p.id, p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_contacts() TO authenticated;
