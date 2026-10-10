ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS pay_token text;
CREATE UNIQUE INDEX IF NOT EXISTS rentals_pay_token_key ON public.rentals(pay_token) WHERE pay_token IS NOT NULL;
UPDATE public.rentals SET pay_token = lower(replace(encode(gen_random_bytes(6),'hex'),'-','')) WHERE pay_token IS NULL;