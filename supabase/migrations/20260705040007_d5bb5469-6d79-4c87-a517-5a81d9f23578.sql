
ALTER TABLE public.loyalty_cards ADD COLUMN ref_number bigserial;
ALTER SEQUENCE public.loyalty_cards_ref_number_seq RESTART WITH 1001;
UPDATE public.loyalty_cards SET ref_number = nextval('public.loyalty_cards_ref_number_seq') WHERE ref_number IS NULL OR ref_number < 1001;
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_cards_ref_number_key ON public.loyalty_cards(ref_number);

ALTER TABLE public.vouchers ADD COLUMN ref_number bigserial;
ALTER SEQUENCE public.vouchers_ref_number_seq RESTART WITH 1001;
UPDATE public.vouchers SET ref_number = nextval('public.vouchers_ref_number_seq') WHERE ref_number IS NULL OR ref_number < 1001;
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_ref_number_key ON public.vouchers(ref_number);
