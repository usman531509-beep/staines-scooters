UPDATE public.vouchers
SET expires_at = NULL,
    status = CASE WHEN status = 'expired' THEN 'active' ELSE status END
WHERE (source ILIKE 'birthday%' OR name ILIKE '%birthday%')
  AND (expires_at IS NOT NULL OR status = 'expired');