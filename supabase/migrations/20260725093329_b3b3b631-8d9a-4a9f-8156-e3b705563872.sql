-- Remove rental weeks created under the old (pre-Monday→Sunday, non-arrears) billing rule.
-- Only unpaid weeks with no linked payments are removed; the billing engine
-- recreates them correctly once each week has ended and the collection day arrives.
DELETE FROM public.rental_weeks w
WHERE w.status <> 'paid'
  AND w.paid_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.rental_payments p WHERE p.week_id = w.id);