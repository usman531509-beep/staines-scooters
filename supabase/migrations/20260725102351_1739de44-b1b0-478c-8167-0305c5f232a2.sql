DELETE FROM public.rental_weeks
WHERE status = 'unpaid'
  AND paid_at IS NULL
  AND week_start > CURRENT_DATE;