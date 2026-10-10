-- Owner of each rental record (the admin who created it). The previous project added
-- this outside the migration history; Stripe Connect uses it to route rental payments
-- to that admin's connected account.
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_bikes ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_customers ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_documents ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_payments ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_pcns ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
ALTER TABLE public.rental_weeks ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT auth.uid();
