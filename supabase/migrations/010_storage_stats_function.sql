-- Backs the Reports "System Storage" widget: a single security-definer function
-- that reports Postgres database size and Supabase Storage usage, callable only
-- with the service-role key (never exposed to anon/authenticated clients).
create or replace function public.get_supabase_storage_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_object_count', (select count(*) from storage.objects)
  );
$$;

revoke all on function public.get_supabase_storage_stats() from public;
revoke all on function public.get_supabase_storage_stats() from anon;
revoke all on function public.get_supabase_storage_stats() from authenticated;
grant execute on function public.get_supabase_storage_stats() to service_role;
