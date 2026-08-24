-- Store Operations Staging UAT Security Runtime.
-- Schema only: no Master, Auth user, access binding, Fact, or Production data is populated here.

create schema if not exists store_operations_uat_private;
revoke all on schema store_operations_uat_private from public, anon, authenticated, service_role;
alter default privileges in schema store_operations_uat_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema store_operations_uat_private
  revoke execute on functions from public, anon, authenticated, service_role;

create table store_operations_uat_private.population_runs (
  artifact_digest text primary key,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  master_version_id uuid not null references governance.master_versions(master_version_id) on delete restrict,
  population_version_id uuid not null references governance.store_population_versions(population_version_id) on delete restrict,
  target_project_ref text not null check (target_project_ref = 'zgkoofphhivesclehrom'),
  corporation_count integer not null check (corporation_count = 6),
  store_count integer not null check (store_count = 20),
  employee_count integer not null check (employee_count = 3),
  assignment_count integer not null check (assignment_count >= 3),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  rollback_manifest_digest text not null check (rollback_manifest_digest ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default statement_timestamp(),
  constraint population_runs_artifact_digest_format check (artifact_digest ~ '^[0-9a-f]{64}$')
);

create table store_operations_uat_private.approved_identities (
  artifact_digest text not null references store_operations_uat_private.population_runs(artifact_digest) on delete restrict,
  identity_key text not null,
  source_subject_digest text not null,
  delivery_digest text not null check (delivery_digest ~ '^[0-9a-f]{64}$'),
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  assignment_version_id uuid not null references core.employee_store_assignments(assignment_version_id) on delete restrict,
  role_key text not null check (role_key in ('executive','area_manager','store_manager')),
  expected_store_id uuid null references core.store_identities(store_id) on delete restrict,
  status text not null default 'approved' check (status in ('approved','revoked')),
  effective_from date not null,
  effective_to date null,
  recorded_at timestamptz not null default statement_timestamp(),
  primary key (artifact_digest, identity_key),
  constraint approved_identities_identity_key_check check (identity_key ~ '^uat-[a-z-]{3,40}$'),
  constraint approved_identities_source_digest_check check (source_subject_digest ~ '^[0-9a-f]{64}$'),
  constraint approved_identities_interval_check check (effective_to is null or effective_to > effective_from),
  constraint approved_identities_store_check check (
    (role_key='executive' and expected_store_id is null)
    or (role_key in ('area_manager','store_manager') and expected_store_id is not null)
  ),
  unique (source_subject_digest),
  unique (employee_id)
);

create table store_operations_uat_private.auth_identity_binding_decisions (
  binding_decision_id uuid primary key default gen_random_uuid(),
  binding_key uuid not null,
  decision_sequence integer not null check (decision_sequence > 0),
  auth_subject_id uuid not null references auth.users(id) on delete restrict,
  artifact_digest text not null,
  identity_key text not null,
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  decision text not null check (decision in ('grant','revoke')),
  effective_at timestamptz not null,
  evidence_reference text not null check (
    evidence_reference ~ '^(approval|artifact|audit):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (artifact_digest,identity_key)
    references store_operations_uat_private.approved_identities(artifact_digest,identity_key) on delete restrict,
  unique (binding_key,decision_sequence)
);
create index auth_identity_binding_subject_idx
  on store_operations_uat_private.auth_identity_binding_decisions(auth_subject_id,binding_key,decision_sequence desc);
create index auth_identity_binding_employee_idx
  on store_operations_uat_private.auth_identity_binding_decisions(employee_id,binding_key,decision_sequence desc);

create table store_operations_uat_private.role_attestation_decisions (
  role_attestation_decision_id uuid primary key default gen_random_uuid(),
  attestation_key uuid not null,
  decision_sequence integer not null check (decision_sequence > 0),
  auth_subject_id uuid not null references auth.users(id) on delete restrict,
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  role_key text not null check (role_key in ('executive','area_manager','store_manager')),
  audience text not null check (audience='store_operations_staging_v1'),
  decision text not null check (decision in ('grant','revoke')),
  effective_at timestamptz not null,
  evidence_reference text not null check (
    evidence_reference ~ '^(approval|artifact|audit):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  recorded_at timestamptz not null default statement_timestamp(),
  unique (attestation_key,decision_sequence)
);
create index role_attestation_subject_idx
  on store_operations_uat_private.role_attestation_decisions(auth_subject_id,attestation_key,decision_sequence desc);

create function store_operations_uat_private.reject_decision_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  raise exception 'STORE_OPERATIONS_UAT_DECISION_APPEND_ONLY';
end
$function$;

create trigger reject_auth_identity_binding_mutation
before update or delete on store_operations_uat_private.auth_identity_binding_decisions
for each row execute function store_operations_uat_private.reject_decision_mutation();
create trigger reject_role_attestation_mutation
before update or delete on store_operations_uat_private.role_attestation_decisions
for each row execute function store_operations_uat_private.reject_decision_mutation();

create function store_operations_uat_private.guard_binding_decision()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare
  prior store_operations_uat_private.auth_identity_binding_decisions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'store-operations-uat|auth-subject|'||new.auth_subject_id::text,0
  ));
  select * into prior from store_operations_uat_private.auth_identity_binding_decisions
    where binding_key=new.binding_key order by decision_sequence desc limit 1;
  if not found then
    if new.decision_sequence<>1 or new.decision<>'grant' then
      raise exception 'STORE_OPERATIONS_UAT_BINDING_CHAIN_INVALID';
    end if;
  elsif new.decision_sequence<>prior.decision_sequence+1 or new.decision=prior.decision
    or new.auth_subject_id<>prior.auth_subject_id or new.employee_id<>prior.employee_id
    or new.artifact_digest<>prior.artifact_digest or new.identity_key<>prior.identity_key then
    raise exception 'STORE_OPERATIONS_UAT_BINDING_CHAIN_INVALID';
  end if;
  if new.decision='grant' and exists (
    with latest as (
      select distinct on(binding_key) *
      from store_operations_uat_private.auth_identity_binding_decisions
      order by binding_key,decision_sequence desc
    ) select 1 from latest where decision='grant'
      and (auth_subject_id=new.auth_subject_id or employee_id=new.employee_id)
  ) then raise exception 'STORE_OPERATIONS_UAT_BINDING_CONFLICT'; end if;
  return new;
end
$function$;

create trigger guard_auth_identity_binding_decision
before insert on store_operations_uat_private.auth_identity_binding_decisions
for each row execute function store_operations_uat_private.guard_binding_decision();

create function store_operations_uat_private.guard_role_attestation_decision()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare
  prior store_operations_uat_private.role_attestation_decisions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'store-operations-uat|role-subject|'||new.auth_subject_id::text,0
  ));
  select * into prior from store_operations_uat_private.role_attestation_decisions
    where attestation_key=new.attestation_key order by decision_sequence desc limit 1;
  if not found then
    if new.decision_sequence<>1 or new.decision<>'grant' then
      raise exception 'STORE_OPERATIONS_UAT_ROLE_CHAIN_INVALID';
    end if;
  elsif new.decision_sequence<>prior.decision_sequence+1 or new.decision=prior.decision
    or new.auth_subject_id<>prior.auth_subject_id or new.employee_id<>prior.employee_id
    or new.role_key<>prior.role_key or new.audience<>prior.audience then
    raise exception 'STORE_OPERATIONS_UAT_ROLE_CHAIN_INVALID';
  end if;
  return new;
end
$function$;

create trigger guard_role_attestation_decision
before insert on store_operations_uat_private.role_attestation_decisions
for each row execute function store_operations_uat_private.guard_role_attestation_decision();

create function public.store_operations_uat_register_auth_v1(
  p_artifact_digest text,p_identity_key text,p_auth_subject uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  approved store_operations_uat_private.approved_identities%rowtype;
  corporation_id_value uuid;
  scope_type_value text;
  store_id_value uuid;
  binding_key_value uuid := gen_random_uuid();
  attestation_key_value uuid := gen_random_uuid();
  scenario text;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' then
    raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY';
  end if;
  if not exists(select 1 from auth.users where id=p_auth_subject and deleted_at is null
    and (banned_until is null or banned_until<=statement_timestamp())) then
    raise exception 'STORE_OPERATIONS_UAT_AUTH_SUBJECT_INACTIVE';
  end if;
  select * into approved from store_operations_uat_private.approved_identities
    where artifact_digest=p_artifact_digest and identity_key=p_identity_key
      and status='approved' and effective_from<=current_date
      and (effective_to is null or current_date<effective_to);
  if not found then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  select r.corporation_id,a.store_id into corporation_id_value,store_id_value
  from core.employee_store_assignments a
  join core.assignment_identities ai on ai.assignment_id=a.assignment_id and ai.identity_status='active'
  join core.corporation_store_relationships r on r.store_id=a.store_id and r.relationship_type='accounting'
  where a.assignment_version_id=approved.assignment_version_id and a.employee_id=approved.employee_id
    and a.status='active' and a.effective_from<=current_date
    and (a.effective_to is null or current_date<a.effective_to)
    and r.effective_from<=current_date and (r.effective_to is null or current_date<r.effective_to)
  limit 1;
  if corporation_id_value is null then raise exception 'STORE_OPERATIONS_UAT_ASSIGNMENT_INACTIVE'; end if;
  scope_type_value := case when approved.role_key='executive' then 'corporation' else 'store' end;

  insert into store_operations_uat_private.auth_identity_binding_decisions(
    binding_key,decision_sequence,auth_subject_id,artifact_digest,identity_key,employee_id,
    decision,effective_at,evidence_reference
  ) values(binding_key_value,1,p_auth_subject,p_artifact_digest,p_identity_key,approved.employee_id,
    'grant',statement_timestamp(),'artifact:'||p_artifact_digest);
  insert into store_operations_uat_private.role_attestation_decisions(
    attestation_key,decision_sequence,auth_subject_id,employee_id,role_key,audience,
    decision,effective_at,evidence_reference
  ) values(attestation_key_value,1,p_auth_subject,approved.employee_id,approved.role_key,
    'store_operations_staging_v1','grant',statement_timestamp(),'artifact:'||p_artifact_digest);

  foreach scenario in array array['actual','budget'] loop
    insert into accounting.consumer_access_contracts(
      access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,
      scope_type,corporation_id,store_id,scenario_type,decision,effective_at,
      evidence_reference,contract_version
    ) values(gen_random_uuid(),1,p_auth_subject,approved.employee_id,approved.assignment_version_id,
      scope_type_value,corporation_id_value,
      case when scope_type_value='store' then store_id_value else null end,
      scenario,'grant',statement_timestamp(),'approval:PR-179','store_operations_uat_v1');
  end loop;
  return jsonb_build_object('registered',true,'role',approved.role_key);
end
$function$;

create function public.store_operations_uat_resolve_access_v1(
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
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' then
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

create function public.store_operations_uat_master_read_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare result jsonb;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'')<>'service_role' then
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

alter table store_operations_uat_private.population_runs enable row level security;
alter table store_operations_uat_private.population_runs force row level security;
alter table store_operations_uat_private.approved_identities enable row level security;
alter table store_operations_uat_private.approved_identities force row level security;
alter table store_operations_uat_private.auth_identity_binding_decisions enable row level security;
alter table store_operations_uat_private.auth_identity_binding_decisions force row level security;
alter table store_operations_uat_private.role_attestation_decisions enable row level security;
alter table store_operations_uat_private.role_attestation_decisions force row level security;

revoke all on all tables in schema store_operations_uat_private from public,anon,authenticated,service_role;
revoke all on all functions in schema store_operations_uat_private from public,anon,authenticated,service_role;
revoke all on function public.store_operations_uat_register_auth_v1(text,text,uuid)
  from public,anon,authenticated;
revoke all on function public.store_operations_uat_resolve_access_v1(uuid,date)
  from public,anon,authenticated;
revoke all on function public.store_operations_uat_master_read_v1()
  from public,anon,authenticated;
grant execute on function public.store_operations_uat_register_auth_v1(text,text,uuid) to service_role;
grant execute on function public.store_operations_uat_resolve_access_v1(uuid,date) to service_role;
grant execute on function public.store_operations_uat_master_read_v1() to service_role;

comment on schema store_operations_uat_private is
  'Staging-only Store Operations UAT identity, attestation, and population audit boundary.';
comment on function public.store_operations_uat_resolve_access_v1(uuid,date) is
  'Service-role-only AUTH-01 resolver. Never callable from a browser role.';
