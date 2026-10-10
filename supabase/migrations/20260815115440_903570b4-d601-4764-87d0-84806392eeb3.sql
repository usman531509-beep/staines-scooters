UPDATE public.categories SET hidden = true WHERE COALESCE(hidden, false) = false;
ALTER TABLE public.categories ALTER COLUMN hidden SET DEFAULT true;