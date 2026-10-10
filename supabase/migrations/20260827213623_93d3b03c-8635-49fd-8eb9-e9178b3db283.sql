CREATE OR REPLACE FUNCTION public.next_hmc_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'HMC-' || lpad(nextval('public.hmc_voucher_seq')::text, 6, '0');
$$;

REVOKE EXECUTE ON FUNCTION public.next_hmc_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_hmc_code() TO authenticated, service_role;