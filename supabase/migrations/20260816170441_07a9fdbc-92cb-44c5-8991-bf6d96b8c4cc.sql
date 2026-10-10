-- Fix: hx_agreements share_token read policy allowed any anon client to bulk-read
-- all public-link agreements (signatures, PII, signing IP) because RLS only checked
-- that share_token was non-null — it never validated that the requester actually
-- supplied the matching token value. Drop the table-level anon SELECT and replace it
-- with a SECURITY DEFINER function that gates access on the exact, unguessable token.

-- 1. Remove the vulnerable table-level anon SELECT policy.
drop policy if exists "hx_agreements share token read" on public.hx_agreements;

-- 2. SECURITY DEFINER function: returns the single agreement matching the supplied
--    token (public_link mode, not expired, not soft-deleted). Anon can only ever
--    reach a row whose share_token they already know in full.
create or replace function public.hx_get_agreement_by_token(p_token uuid)
returns setof public.hx_agreements
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.hx_agreements a
  where a.share_token = p_token
    and a.signing_mode = 'public_link'
    and (a.token_expires_at is null or a.token_expires_at > now())
    and coalesce(a.is_deleted, false) = false
$$;

-- 3. Let anon call the function (read-only, token-gated). No table SELECT grant to anon.
grant execute on function public.hx_get_agreement_by_token(uuid) to anon, authenticated;

-- Revoke any accidental direct anon table access (defensive; should already be absent).
revoke select on public.hx_agreements from anon;