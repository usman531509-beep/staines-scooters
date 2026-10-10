ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS duplicate_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_reasons text;

CREATE INDEX IF NOT EXISTS profiles_signup_ip_idx ON public.profiles (signup_ip);