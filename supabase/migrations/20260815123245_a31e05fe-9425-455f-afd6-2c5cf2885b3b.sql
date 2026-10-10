ALTER TABLE public.dawat_profiles ADD COLUMN IF NOT EXISTS pay_token text;
CREATE UNIQUE INDEX IF NOT EXISTS dawat_profiles_pay_token_key ON public.dawat_profiles (pay_token) WHERE pay_token IS NOT NULL;
UPDATE public.dawat_profiles SET pay_token = substr(replace(gen_random_uuid()::text,'-',''),1,8) WHERE pay_token IS NULL;