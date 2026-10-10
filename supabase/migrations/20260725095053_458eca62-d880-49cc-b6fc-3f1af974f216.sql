DELETE FROM public.rental_weeks w
WHERE w.status <> 'paid'
  AND NOT EXISTS (SELECT 1 FROM public.rental_payments p WHERE p.week_id = w.id);