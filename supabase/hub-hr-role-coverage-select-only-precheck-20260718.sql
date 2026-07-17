-- Aggregate SELECT-only coverage check. No employee, credential, or assignment identifiers are projected.
with hr_roles as (
  select r.id, r.role_key
  from public.roles r
  where r.role_key in ('hr.staff', 'hr.admin')
    and r.is_active is distinct from false
), active_assignments as (
  select er.employee_id, er.role_id, er.scope_type, er.scope_id
  from public.employee_roles er
  join hr_roles r on r.id = er.role_id
  where er.is_active is distinct from false
), assignment_groups as (
  select employee_id, role_id, coalesce(scope_type, ''), scope_id, count(*)::integer as assignment_count
  from active_assignments
  group by employee_id, role_id, coalesce(scope_type, ''), scope_id
), employee_coverage as (
  select
    aa.employee_id,
    bool_or(e.id is not null and e.is_active is distinct from false) as employee_active,
    bool_or(c.employee_id is not null) as credential_present,
    bool_or(c.login_enabled is true) as login_enabled,
    bool_or(c.locked_until is not null and c.locked_until > pg_catalog.now()) as currently_locked
  from active_assignments aa
  left join public.employees e on e.id = aa.employee_id
  left join public.employee_login_credentials c on c.employee_id = aa.employee_id
  group by aa.employee_id
)
select
  (select count(*)::integer from hr_roles) as active_hr_role_definition_count,
  (select count(*)::integer from active_assignments) as active_hr_role_assignment_count,
  (select count(distinct employee_id)::integer from active_assignments) as distinct_assigned_employee_count,
  (select count(*)::integer from employee_coverage where employee_active) as active_assigned_employee_count,
  (select count(*)::integer from employee_coverage where employee_active and credential_present and login_enabled and not currently_locked) as login_ready_employee_count,
  (select count(*)::integer from employee_coverage where not credential_present) as missing_credential_count,
  (select count(*)::integer from employee_coverage where credential_present and not login_enabled) as login_disabled_count,
  (select count(*)::integer from employee_coverage where currently_locked) as currently_locked_count,
  (select count(*)::integer from assignment_groups where assignment_count > 1) as duplicate_active_assignment_group_count,
  (select count(*)::integer from active_assignments where coalesce(scope_type, '') = 'all' and scope_id is null) as all_scope_assignment_count;
