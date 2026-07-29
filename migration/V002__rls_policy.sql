-- Phase 8 candidate. DO NOT EXECUTE without identity and scope prechecks.
-- Default-deny behavior is intentional when JWT-to-employee evidence is absent.

begin;

create or replace function public.core_current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.is_active is distinct from false
    and e.firebase_uid = auth.uid()::text
  order by e.updated_at desc nulls last
  limit 1;
$$;

create or replace function public.core_store_history_read_allowed(p_store_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select public.core_current_employee_id() as employee_id
  ), actor_roles as (
    select r.role_key, er.scope_type, er.scope_id
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    join actor a on a.employee_id = er.employee_id
    where er.is_active is distinct from false
  )
  select exists (
    select 1 from actor_roles
    where role_key in ('super_admin', 'representative', 'executive')
  )
  or exists (
    select 1 from actor_roles
    where role_key = 'store_manager'
      and scope_type = 'store'
      and scope_id = p_store_uuid
  )
  or exists (
    select 1
    from actor_roles ar
    join public.stores s on s.id = p_store_uuid
    where ar.role_key = 'fc_owner'
      and ar.scope_type = 'corporation'
      and ar.scope_id = s.corporation_id
  )
  or exists (
    select 1
    from public.employees e
    join actor a on a.employee_id = e.id
    where e.is_active is distinct from false
      and e.store_id = p_store_uuid
  );
$$;

create or replace function public.core_store_history_write_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = public.core_current_employee_id()
      and er.is_active is distinct from false
      and r.role_key in ('super_admin', 'representative', 'executive')
  );
$$;

revoke all on function public.core_current_employee_id() from public;
revoke all on function public.core_store_history_read_allowed(uuid) from public;
revoke all on function public.core_store_history_write_allowed() from public;
grant execute on function public.core_current_employee_id() to authenticated;
grant execute on function public.core_store_history_read_allowed(uuid) to authenticated;
grant execute on function public.core_store_history_write_allowed() to authenticated;

drop policy if exists store_operation_history_select_scoped
  on public.store_operation_history;
create policy store_operation_history_select_scoped
on public.store_operation_history
for select to authenticated
using (public.core_store_history_read_allowed(store_uuid));

drop policy if exists store_operation_history_insert_representative_executive
  on public.store_operation_history;
create policy store_operation_history_insert_representative_executive
on public.store_operation_history
for insert to authenticated
with check (public.core_store_history_write_allowed());

drop policy if exists store_operation_history_update_representative_executive
  on public.store_operation_history;
create policy store_operation_history_update_representative_executive
on public.store_operation_history
for update to authenticated
using (public.core_store_history_write_allowed())
with check (public.core_store_history_write_allowed());

-- Department managers receive no policy until an approved department-to-store
-- membership relation exists. No delete policy is created.

commit;
