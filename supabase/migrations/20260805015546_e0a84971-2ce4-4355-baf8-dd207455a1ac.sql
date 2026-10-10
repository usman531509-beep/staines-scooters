CREATE TABLE public.signup_claims (
  token UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  consumed_at TIMESTAMPTZ
);
CREATE INDEX signup_claims_email_idx ON public.signup_claims (email);
GRANT ALL ON public.signup_claims TO service_role;
ALTER TABLE public.signup_claims ENABLE ROW LEVEL SECURITY;