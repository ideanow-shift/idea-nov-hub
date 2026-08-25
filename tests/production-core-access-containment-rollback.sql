\set ON_ERROR_STOP on
\ir ../supabase/rollback/production_core_access_containment_v1.rollback.sql
do $$
declare table_name text;
begin
  foreach table_name in array array['account_titles','corporations','departments','employee_roles','employees','positions','roles','stores','vendors'] loop
    if not has_table_privilege('authenticated',format('core.%I',table_name),'SELECT') then raise exception 'rollback grant missing for core.%',table_name; end if;
    if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='core' and c.relname=table_name and (c.relrowsecurity or c.relforcerowsecurity)) then raise exception 'rollback RLS state incorrect for core.%',table_name; end if;
  end loop;
  if not has_function_privilege('anon','core.dev_seed_employee(text,text,text,text)','EXECUTE') or not has_function_privilege('authenticated','core.link_employee_to_auth_user(text)','EXECUTE') then raise exception 'rollback function ACL missing'; end if;
end$$;
