
-- Drop email_for_phone: replaced with a server-side sign-in helper that never leaks the email.
DROP FUNCTION IF EXISTS public.email_for_phone(text);
