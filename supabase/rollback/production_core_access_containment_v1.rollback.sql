-- Emergency rollback only. This restores the audited pre-corrective ACL/RLS state.
alter table core.account_titles no force row level security;
alter table core.account_titles disable row level security;
alter table core.corporations no force row level security;
alter table core.corporations disable row level security;
alter table core.departments no force row level security;
alter table core.departments disable row level security;
alter table core.employee_roles no force row level security;
alter table core.employee_roles disable row level security;
alter table core.employees no force row level security;
alter table core.employees disable row level security;
alter table core.positions no force row level security;
alter table core.positions disable row level security;
alter table core.roles no force row level security;
alter table core.roles disable row level security;
alter table core.stores no force row level security;
alter table core.stores disable row level security;
alter table core.vendors no force row level security;
alter table core.vendors disable row level security;

grant select on table core.account_titles,core.corporations,core.departments,
  core.employee_roles,core.employees,core.positions,core.roles,core.stores,core.vendors
  to authenticated;
revoke select on table core.account_titles,core.corporations,core.departments,
  core.employee_roles,core.positions,core.roles,core.vendors from service_role;

grant execute on function core.dev_seed_employee(text,text,text,text),
  core.link_employee_to_auth_user(text),core.current_employee_id(),
  core.current_employee_has_any_role(text[]),core.current_employee_profile(),
  core.employee_admin_options(),core.permission_admin_options(),core.has_role(text),
  core.has_global_role(text),core.has_scoped_role(text,text,uuid),core.can_manage_permissions()
  to public,anon,authenticated;

alter function core.dev_seed_employee(text,text,text,text) set search_path=core,public;
alter function core.link_employee_to_auth_user(text) set search_path=core,auth,public;
alter function core.current_employee_id() set search_path=core,auth,public;
alter function core.current_employee_has_any_role(text[]) set search_path=core,public;
alter function core.current_employee_profile() security invoker;
alter function core.current_employee_profile() set search_path=core,public;
alter function core.employee_admin_options() set search_path=core,public;
alter function core.permission_admin_options() set search_path=core,public;
alter function core.has_role(text) security invoker;
alter function core.has_role(text) reset search_path;
alter function core.has_global_role(text) security invoker;
alter function core.has_global_role(text) reset search_path;
alter function core.has_scoped_role(text,text,uuid) security invoker;
alter function core.has_scoped_role(text,text,uuid) reset search_path;
alter function core.can_manage_permissions() security invoker;
alter function core.can_manage_permissions() reset search_path;
