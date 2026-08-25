-- Production Core Access Containment V1.
-- This migration is promotion-only: it contains no business-data mutation.

do $$
declare
  target_tables constant text[] := array[
    'account_titles','corporations','departments','employee_roles','employees',
    'positions','roles','stores','vendors'
  ];
  table_name text;
begin
  foreach table_name in array target_tables loop
    if to_regclass(format('core.%I', table_name)) is null then
      raise exception 'CORE_ACCESS_PRECONDITION_FAILED: missing core.%', table_name;
    end if;
    if (select c.relrowsecurity or c.relforcerowsecurity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='core' and c.relname=table_name) then
      raise exception 'CORE_ACCESS_PRECONDITION_FAILED: unexpected RLS state on core.%', table_name;
    end if;
    if exists(select 1 from pg_policies where schemaname='core' and tablename=table_name) then
      raise exception 'CORE_ACCESS_PRECONDITION_FAILED: unexpected policy on core.%', table_name;
    end if;
    if not has_table_privilege('authenticated',format('core.%I',table_name),'SELECT') then
      raise exception 'CORE_ACCESS_PRECONDITION_FAILED: authenticated SELECT drift on core.%', table_name;
    end if;
  end loop;

  if to_regprocedure('core.dev_seed_employee(text,text,text,text)') is null
     or to_regprocedure('core.link_employee_to_auth_user(text)') is null
     or to_regprocedure('core.current_employee_id()') is null
     or to_regprocedure('core.current_employee_has_any_role(text[])') is null
     or to_regprocedure('core.current_employee_profile()') is null
     or to_regprocedure('core.employee_admin_options()') is null
     or to_regprocedure('core.permission_admin_options()') is null
     or to_regprocedure('core.has_role(text)') is null
     or to_regprocedure('core.has_global_role(text)') is null
     or to_regprocedure('core.has_scoped_role(text,text,uuid)') is null
     or to_regprocedure('core.can_manage_permissions()') is null then
    raise exception 'CORE_ACCESS_PRECONDITION_FAILED: expected function signature missing';
  end if;

  if not has_function_privilege('anon','core.dev_seed_employee(text,text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','core.dev_seed_employee(text,text,text,text)','EXECUTE')
     or not has_function_privilege('anon','core.link_employee_to_auth_user(text)','EXECUTE')
     or not has_function_privilege('authenticated','core.link_employee_to_auth_user(text)','EXECUTE') then
    raise exception 'CORE_ACCESS_PRECONDITION_FAILED: critical function ACL drift';
  end if;
end
$$;

alter table core.account_titles enable row level security;
alter table core.account_titles force row level security;
alter table core.corporations enable row level security;
alter table core.corporations force row level security;
alter table core.departments enable row level security;
alter table core.departments force row level security;
alter table core.employee_roles enable row level security;
alter table core.employee_roles force row level security;
alter table core.employees enable row level security;
alter table core.employees force row level security;
alter table core.positions enable row level security;
alter table core.positions force row level security;
alter table core.roles enable row level security;
alter table core.roles force row level security;
alter table core.stores enable row level security;
alter table core.stores force row level security;
alter table core.vendors enable row level security;
alter table core.vendors force row level security;

revoke all on table core.account_titles,core.corporations,core.departments,
  core.employee_roles,core.employees,core.positions,core.roles,core.stores,core.vendors
  from public,anon,authenticated;
grant select on table core.account_titles,core.corporations,core.departments,
  core.employee_roles,core.employees,core.positions,core.roles,core.stores,core.vendors
  to service_role;

revoke execute on function core.dev_seed_employee(text,text,text,text) from public,anon,authenticated;
revoke execute on function core.link_employee_to_auth_user(text) from public,anon,authenticated;
grant execute on function core.dev_seed_employee(text,text,text,text) to service_role;
grant execute on function core.link_employee_to_auth_user(text) to service_role;

revoke execute on function core.current_employee_id() from public,anon;
revoke execute on function core.current_employee_has_any_role(text[]) from public,anon;
revoke execute on function core.current_employee_profile() from public,anon;
revoke execute on function core.employee_admin_options() from public,anon;
revoke execute on function core.permission_admin_options() from public,anon;
revoke execute on function core.has_role(text) from public,anon;
revoke execute on function core.has_global_role(text) from public,anon;
revoke execute on function core.has_scoped_role(text,text,uuid) from public,anon;
revoke execute on function core.can_manage_permissions() from public,anon;

grant execute on function core.current_employee_id(),core.current_employee_has_any_role(text[]),
  core.current_employee_profile(),core.employee_admin_options(),core.permission_admin_options(),
  core.has_role(text),core.has_global_role(text),core.has_scoped_role(text,text,uuid),
  core.can_manage_permissions() to authenticated,service_role;

alter function core.dev_seed_employee(text,text,text,text) set search_path=pg_catalog;
alter function core.link_employee_to_auth_user(text) set search_path=pg_catalog;
alter function core.current_employee_id() set search_path=pg_catalog;
alter function core.current_employee_has_any_role(text[]) set search_path=pg_catalog;
alter function core.current_employee_profile() security definer;
alter function core.current_employee_profile() set search_path=pg_catalog;
alter function core.employee_admin_options() set search_path=pg_catalog;
alter function core.permission_admin_options() set search_path=pg_catalog;
alter function core.has_role(text) security definer;
alter function core.has_role(text) set search_path=pg_catalog;
alter function core.has_global_role(text) security definer;
alter function core.has_global_role(text) set search_path=pg_catalog;
alter function core.has_scoped_role(text,text,uuid) security definer;
alter function core.has_scoped_role(text,text,uuid) set search_path=pg_catalog;
alter function core.can_manage_permissions() security definer;
alter function core.can_manage_permissions() set search_path=pg_catalog;
