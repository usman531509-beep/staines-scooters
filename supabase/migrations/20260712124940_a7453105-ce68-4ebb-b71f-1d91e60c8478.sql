
ALTER TABLE public.dawat_dinner_attendees
  ADD COLUMN IF NOT EXISTS amount_paid_pence integer NOT NULL DEFAULT 0
  CHECK (amount_paid_pence >= 0);

-- Backfill: for existing split dinners, the single payer contributed the full total.
UPDATE public.dawat_dinner_attendees a
SET amount_paid_pence = d.total_amount_pence
FROM public.dawat_dinners d
WHERE a.dinner_id = d.id
  AND a.profile_id = d.payer_id
  AND a.amount_paid_pence = 0;
