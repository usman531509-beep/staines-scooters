ALTER TABLE public.rental_bikes
  ADD COLUMN IF NOT EXISTS mot_expiry_date date,
  ADD COLUMN IF NOT EXISTS mot_status text,
  ADD COLUMN IF NOT EXISTS mot_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS mot_alert_sent_for date;