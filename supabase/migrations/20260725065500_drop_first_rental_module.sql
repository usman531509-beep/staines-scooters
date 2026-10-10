-- The first rental module (20260717085437) was dropped outside the migration history
-- before the rebuilt module below was created; replay that drop on a fresh database.
DROP TABLE IF EXISTS public.rental_pcns, public.rental_payments, public.rental_weeks,
  public.rental_documents, public.rentals, public.rental_bikes, public.rental_settings CASCADE;
