create or replace function public.get_nov_hub_bootstrap_by_email(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with target_employee as (
    select
      e.*
    from public.employees e
    left join public.employee_login_credentials c
      on c.employee_id = e.id
    where lower(coalesce(c.login_email, e.email)) = lower(trim(p_email))
      and e.is_active is distinct from false
    order by e.updated_at desc nulls last
    limit 1
  ),
  role_rows as (
    select
      er.employee_id,
      jsonb_agg(
        jsonb_build_object(
          'roleKey', r.role_key,
          'roleName', r.role_name,
          'scopeType', coalesce(er.scope_type, ''),
          'scopeId', er.scope_id
        )
        order by r.role_key
      ) filter (where r.role_key is not null) as roles
    from public.employee_roles er
    join public.roles r
      on r.id = er.role_id
    join target_employee e
      on e.id = er.employee_id
    where er.is_active is distinct from false
    group by er.employee_id
  ),
  store_assignment_rows as (
    select
      esa.employee_id,
      jsonb_agg(
        jsonb_build_object(
          'storeId', esa.store_id,
          'storeNo', s.store_no,
          'storeCode', s.store_id,
          'storeName', s.store_name,
          'assignmentType', esa.assignment_type,
          'priority', esa.assignment_order
        )
        order by esa.assignment_order
      ) as store_assignments
    from public.employee_store_assignments esa
    left join public.stores s
      on s.id = esa.store_id
    join target_employee e
      on e.id = esa.employee_id
    where esa.is_active is distinct from false
      and (esa.effective_to is null or esa.effective_to >= current_date)
    group by esa.employee_id
  )
  select case
    when e.id is null then null
    else jsonb_build_object(
      'employee', jsonb_build_object(
        'id', e.id,
        'employeeId', e.employee_id,
        'fullName', e.full_name,
        'email', e.email,
        'employmentStatus', e.employment_status,
        'employmentType', e.employment_type,
        'firebaseUid', e.firebase_uid,
        'isActive', e.is_active,
        'sourceRow', e.source_row
      ),
      'corporation', case when corp.id is null then null else jsonb_build_object(
        'id', corp.id,
        'code', corp.corporation_no,
        'name', corp.corporation_name
      ) end,
      'store', case when s.id is null then null else jsonb_build_object(
        'id', s.id,
        'storeNo', s.store_no,
        'storeCode', s.store_id,
        'name', s.store_name
      ) end,
      'department', case when d.id is null then null else jsonb_build_object(
        'id', d.id,
        'code', d.department_code,
        'name', d.department_name
      ) end,
      'position', case when p.id is null then null else jsonb_build_object(
        'id', p.id,
        'name', p.position_name
      ) end,
      'roles', coalesce(rr.roles, '[]'::jsonb),
      'storeAssignments', coalesce(sar.store_assignments, '[]'::jsonb),
      'loginStatus', case when c.id is null then null else jsonb_build_object(
        'id', c.id,
        'employee_id', c.employee_id,
        'login_email', c.login_email,
        'pin_set', c.pin_hash is not null,
        'pin_updated_at', c.pin_updated_at,
        'must_change_pin', c.must_change_pin,
        'login_enabled', c.login_enabled,
        'failed_attempts', c.failed_attempts,
        'locked_until', c.locked_until,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) end
    )
  end
  from target_employee e
  left join public.employee_login_credentials c
    on c.employee_id = e.id
  left join public.corporations corp
    on corp.id = e.corporation_id
  left join public.stores s
    on s.id = e.store_id
  left join public.departments d
    on d.id = e.department_id
  left join public.positions p
    on p.id = e.position_id
  left join role_rows rr
    on rr.employee_id = e.id
  left join store_assignment_rows sar
    on sar.employee_id = e.id;
$$;

revoke all on function public.get_nov_hub_bootstrap_by_email(text) from public;
grant execute on function public.get_nov_hub_bootstrap_by_email(text) to service_role;

comment on function public.get_nov_hub_bootstrap_by_email(text) is
  'NOV HUB login bootstrap RPC. Returns one employee context only. Does not return pin_hash or secrets.';
