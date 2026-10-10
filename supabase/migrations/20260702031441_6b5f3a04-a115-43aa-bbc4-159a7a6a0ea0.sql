
REVOKE EXECUTE ON FUNCTION public.next_hmc_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_hmc_code()
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 'HMC-' || lpad(nextval('public.hmc_voucher_seq')::text, 6, '0');
$$;

GRANT USAGE ON SEQUENCE public.hmc_voucher_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_hmc_code() TO authenticated, service_role;
