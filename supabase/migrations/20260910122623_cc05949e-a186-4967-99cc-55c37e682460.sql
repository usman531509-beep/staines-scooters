-- Harden rentals ownership linkage: only rental staff may set or change
-- customer_id / rental_customer_id, so a user can never self-assign a rental.
create or replace function public.rentals_protect_customer_linkage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / internal jobs (no auth uid) and rental staff are allowed.
  if auth.uid() is null or public.is_rental_staff(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Only staff can create rentals';
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.rental_customer_id is distinct from old.rental_customer_id then
    raise exception 'Only staff can change the rental customer';
  end if;

  return new;
end;
$$;

drop trigger if exists rentals_protect_customer_linkage on public.rentals;
create trigger rentals_protect_customer_linkage
before insert or update on public.rentals
for each row execute function public.rentals_protect_customer_linkage();