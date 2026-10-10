CREATE OR REPLACE FUNCTION public.db_storage_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
  is_admin boolean;
begin
  if auth.uid() is not null then
    select exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role::text in ('owner','admin')
    ) into is_admin;
    if not is_admin then
      raise exception 'not authorised';
    end if;
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
$function$;

GRANT EXECUTE ON FUNCTION public.db_storage_usage() TO authenticated, service_role;