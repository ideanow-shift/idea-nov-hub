-- Staging-only corrective for Store Operations Hosted UAT.
-- PostgREST assigns the database role even when a non-JWT secret key leaves the
-- legacy per-claim GUC empty. Function ACLs remain the primary
-- browser boundary and the active role check keeps the runtime fail-closed.

create or replace function public.store_operations_uat_resolve_access_v1(
  p_auth_subject uuid,p_as_of date
) returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare
  binding store_operations_uat_private.auth_identity_binding_decisions%rowtype;
  role_key_value text;
  store_ids uuid[];
  scope_mode text;
begin
  if coalesce(pg_catalog.current_setting('role',true),'')<>'service_role' then
    raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY';
  end if;
  if not exists(select 1 from auth.users where id=p_auth_subject and deleted_at is null
    and (banned_until is null or banned_until<=statement_timestamp())) then
    raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED';
  end if;
  select latest.* into binding from (
    select distinct on(binding_key) * from store_operations_uat_private.auth_identity_binding_decisions
    where auth_subject_id=p_auth_subject and effective_at<=statement_timestamp()
    order by binding_key,decision_sequence desc
  ) latest where latest.decision='grant';
  if not found then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  if not exists(select 1 from core.employee_identities i join core.employees e using(employee_id)
    where i.employee_id=binding.employee_id and i.identity_status='active' and e.status='active'
      and e.effective_from<=p_as_of and (e.effective_to is null or p_as_of<e.effective_to)) then
    raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED';
  end if;
  select latest.role_key into role_key_value from (
    select distinct on(attestation_key) * from store_operations_uat_private.role_attestation_decisions
    where auth_subject_id=p_auth_subject and employee_id=binding.employee_id
      and audience='store_operations_staging_v1' and effective_at<=statement_timestamp()
    order by attestation_key,decision_sequence desc
  ) latest where latest.decision='grant';
  if role_key_value is null then raise exception 'STORE_OPERATIONS_UAT_FORBIDDEN'; end if;
  if not exists(select 1 from accounting.current_consumer_access_contracts(
    p_auth_subject,
    (select r.corporation_id from core.employee_store_assignments a
      join core.corporation_store_relationships r on r.store_id=a.store_id and r.relationship_type='accounting'
      where a.employee_id=binding.employee_id and a.status='active'
        and a.effective_from<=p_as_of and (a.effective_to is null or p_as_of<a.effective_to) limit 1),
    p_as_of,'actual')) then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;

  if role_key_value='executive' then
    select array_agg(s.store_id order by s.store_code) into store_ids
    from projection.store_master_v1 s where s.in_official_population and s.is_active;
    scope_mode:='all';
  elsif role_key_value='area_manager' then
    select array_agg(distinct a.store_id order by a.store_id) into store_ids
    from core.employee_store_assignments a
    join projection.store_master_v1 s on s.store_id=a.store_id and s.in_official_population and s.is_active
    where a.employee_id=binding.employee_id and a.status='active'
      and a.effective_from<=p_as_of and (a.effective_to is null or p_as_of<a.effective_to);
    scope_mode:='assigned';
  else
    select array_agg(a.store_id order by a.assignment_kind,a.store_id) into store_ids
    from core.employee_store_assignments a
    join projection.store_master_v1 s on s.store_id=a.store_id and s.in_official_population and s.is_active
    where a.employee_id=binding.employee_id and a.status='active' and a.assignment_kind='primary'
      and a.effective_from<=p_as_of and (a.effective_to is null or p_as_of<a.effective_to);
    scope_mode:='own';
  end if;
  if coalesce(cardinality(store_ids),0)=0
    or (role_key_value='executive' and cardinality(store_ids)<>20)
    or (role_key_value='store_manager' and cardinality(store_ids)<>1) then
    raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED';
  end if;
  return jsonb_build_object('employeeId',binding.employee_id,'roleKeys',jsonb_build_array(role_key_value),
    'scope',jsonb_build_object('mode',scope_mode,'storeIds',to_jsonb(store_ids)));
end
$function$;

create or replace function public.store_operations_uat_master_read_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare result jsonb;
begin
  if coalesce(pg_catalog.current_setting('role',true),'')<>'service_role' then
    raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY';
  end if;
  select jsonb_build_object(
    'stores',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.store_id,'store_no',s.store_code,'store_id',s.store_code,'store_name',s.store_name,
      'corporation_id',s.corporation_id,'store_type',case s.store_type when 'direct' then '直営' else 'FC' end,
      'is_active',s.is_active) order by s.store_code)
      from projection.store_master_v1 s where s.in_official_population and s.is_active),'[]'::jsonb),
    'corporations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.corporation_id,'corporation_code',c.corporation_code,
      'corporation_name',c.display_name,'is_active',c.status='active') order by c.corporation_code)
      from projection.corporation_master_v1 c where c.status='active'),'[]'::jsonb),
    'corporation_business_profiles',coalesce((select jsonb_agg(jsonb_build_object(
      'corporation_id',c.corporation_id,'fiscal_year_end_month',8) order by c.corporation_code)
      from projection.corporation_master_v1 c where c.status='active'),'[]'::jsonb)
  ) into result;
  return result;
end
$function$;

revoke all on function public.store_operations_uat_resolve_access_v1(uuid,date)
  from public,anon,authenticated;
revoke all on function public.store_operations_uat_resolve_access_v2(uuid)
  from public,anon,authenticated;
revoke all on function public.store_operations_uat_master_read_v1()
  from public,anon,authenticated;
grant execute on function public.store_operations_uat_resolve_access_v1(uuid,date) to service_role;
grant execute on function public.store_operations_uat_resolve_access_v2(uuid) to service_role;
grant execute on function public.store_operations_uat_master_read_v1() to service_role;

comment on function public.store_operations_uat_resolve_access_v1(uuid,date) is
  'Service-role-only AUTH-01 resolver using the active PostgREST database role. Never callable from a browser role.';
comment on function public.store_operations_uat_master_read_v1() is
  'Service-role-only Staging UAT master read using the active PostgREST database role. Never callable from a browser role.';
