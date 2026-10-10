ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS deleted_by uuid;