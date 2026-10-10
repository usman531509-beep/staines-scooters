UPDATE public.rental_weeks w
SET days_charged = 7,
    amount_pence = r.weekly_rate_pence
FROM public.rentals r
WHERE w.rental_id = r.id
  AND w.status = 'unpaid'
  AND (w.days_charged <> 7 OR w.amount_pence <> r.weekly_rate_pence);