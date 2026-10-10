
-- 1. Pin search_path on the four email-queue helpers (fixes "Function Search Path Mutable")
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Revoke EXECUTE from anon/authenticated on internal helpers.
--    These are trigger bodies or server-only helpers that must NOT be callable
--    through the Data API (PostgREST). service_role keeps access.

-- Trigger + short-code helpers: only the trigger machinery and server code need them.
REVOKE EXECUTE ON FUNCTION public.assign_profile_short_code()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_profile_short_code() FROM PUBLIC, anon, authenticated;

-- Email-queue helpers: only the server-side email pipeline uses them.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)         FROM PUBLIC, anon, authenticated;

-- HMC voucher sequence: server-side only.
REVOKE EXECUTE ON FUNCTION public.next_hmc_code() FROM PUBLIC, anon, authenticated;

-- Dawat membership check: signed-in users don't need to call this directly;
-- it's used by RLS policies internally (SECURITY DEFINER handles that).
REVOKE EXECUTE ON FUNCTION public.is_dawat_member(uuid) FROM PUBLIC, anon, authenticated;

-- NOTE: We deliberately KEEP anon+authenticated EXECUTE on:
--   * public.phone_available(text)  -- called from the sign-up form before login
--   * public.has_role(uuid, app_role) / public.has_dawat_role(...) -- used by RLS
--   * public.get_loyalty_settings() -- gated by auth.uid() check inside the fn
