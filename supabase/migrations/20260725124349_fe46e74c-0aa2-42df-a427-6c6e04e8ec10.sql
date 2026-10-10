UPDATE public.rental_weeks w
SET days_charged = 7,
    amount_pence = r.weekly_rate_pence
FROM public.rentals r
WHERE r.id = w.rental_id
  AND w.status = 'unpaid'
  AND w.deleted_at IS NULL
  AND (w.amount_pence <> r.weekly_rate_pence OR w.days_charged <> 7);