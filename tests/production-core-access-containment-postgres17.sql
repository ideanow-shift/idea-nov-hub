\set ON_ERROR_STOP on
do $$
declare table_name text;
begin
  foreach table_name in array array['account_titles','corporations','departments','employee_roles','employees','positions','roles','stores','vendors'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='core' and c.relname=table_name and c.relrowsecurity and c.relforcerowsecurity) then
      raise exception 'RLS/FORCE RLS missing for core.%',table_name;
    end if;
    if has_table_privilege('anon',format('core.%I',table_name),'SELECT') or has_table_privilege('authenticated',format('core.%I',table_name),'SELECT') then
      raise exception 'browser table read remains for core.%',table_name;
    end if;
    if not has_table_privilege('service_role',format('core.%I',table_name),'SELECT') then
      raise exception 'service read missing for core.%',table_name;
    end if;
  end loop;
  if has_function_privilege('anon','core.dev_seed_employee(text,text,text,text)','EXECUTE') or has_function_privilege('authenticated','core.dev_seed_employee(text,text,text,text)','EXECUTE') then raise exception 'dev seed browser execute remains'; end if;
  if has_function_privilege('anon','core.link_employee_to_auth_user(text)','EXECUTE') or has_function_privilege('authenticated','core.link_employee_to_auth_user(text)','EXECUTE') then raise exception 'auth link browser execute remains'; end if;
  if not has_function_privilege('service_role','core.dev_seed_employee(text,text,text,text)','EXECUTE') or not has_function_privilege('service_role','core.link_employee_to_auth_user(text)','EXECUTE') then raise exception 'service function path missing'; end if;
  if has_function_privilege('anon','core.current_employee_id()','EXECUTE') or not has_function_privilege('authenticated','core.current_employee_id()','EXECUTE') then raise exception 'scoped helper ACL incorrect'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='core' and p.proname in ('dev_seed_employee','link_employee_to_auth_user','current_employee_id','current_employee_has_any_role','current_employee_profile','employee_admin_options','permission_admin_options','has_role','has_global_role','has_scoped_role','can_manage_permissions') and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=pg_catalog%') then raise exception 'mutable function search_path remains'; end if;
end$$;

set role authenticated;
select core.current_employee_id();
select core.current_employee_profile();
select core.employee_admin_options();
select core.permission_admin_options();
reset role;
set role service_role;
select count(*) from core.employees;
reset role;
