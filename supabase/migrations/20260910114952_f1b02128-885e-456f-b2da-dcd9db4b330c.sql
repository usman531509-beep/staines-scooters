create or replace function public.db_storage_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') and not public.has_role(auth.uid(), 'owner') then
    raise exception 'not authorised';
  end if;
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'top_tables', coalesce((
      select jsonb_agg(t) from (
        select c.relname as name, pg_total_relation_size(c.oid) as bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.db_storage_usage() from public;
grant execute on function public.db_storage_usage() to authenticated;
grant execute on function public.db_storage_usage() to service_role;