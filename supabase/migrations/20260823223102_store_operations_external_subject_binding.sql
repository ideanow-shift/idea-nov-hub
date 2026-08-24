-- NOV HUB Staging External Subject Binding V1.
-- Staging-only security control. Stores no raw external subject, token, email, role or scope.

begin;

create table store_operations_uat_private.external_subject_enrollment_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  challenge_hash text not null unique check (challenge_hash ~ '^[0-9a-f]{64}$'),
  artifact_digest text not null,
  identity_key text not null,
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  approval_reference text not null check (approval_reference = 'approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  foreign key (artifact_digest,identity_key)
    references store_operations_uat_private.approved_identities(artifact_digest,identity_key) on delete restrict,
  check (identity_key='uat-executive'),
  check (expires_at>created_at and expires_at<=created_at+interval '10 minutes'),
  check ((consumed_at is null and request_id is null) or (consumed_at is not null and request_id is not null))
);

create table store_operations_uat_private.external_subject_binding_decisions (
  binding_decision_id uuid primary key default gen_random_uuid(),
  binding_key uuid not null,
  decision_sequence integer not null check (decision_sequence>0),
  provider text not null check (provider='google.com'),
  issuer text not null check (issuer='https://securetoken.google.com/idea-nov-group-portal'),
  audience text not null check (audience='idea-nov-group-portal'),
  subject_fingerprint text not null check (subject_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_key_version integer not null check (fingerprint_key_version=1),
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  decision text not null check (decision in ('grant','revoke')),
  effective_at timestamptz not null,
  effective_to timestamptz,
  evidence_reference text not null check (evidence_reference='approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1'),
  enrollment_challenge_id uuid references store_operations_uat_private.external_subject_enrollment_challenges(challenge_id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  unique(binding_key,decision_sequence),
  check (effective_to is null or effective_to>effective_at),
  check ((decision='grant' and enrollment_challenge_id is not null) or decision='revoke')
);

alter table store_operations_uat_private.external_subject_enrollment_challenges enable row level security;
alter table store_operations_uat_private.external_subject_enrollment_challenges force row level security;
alter table store_operations_uat_private.external_subject_binding_decisions enable row level security;
alter table store_operations_uat_private.external_subject_binding_decisions force row level security;

create function store_operations_uat_private.reject_external_subject_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  raise exception 'STORE_OPERATIONS_EXTERNAL_SUBJECT_APPEND_ONLY';
end
$function$;

create trigger reject_external_binding_mutation
before update or delete on store_operations_uat_private.external_subject_binding_decisions
for each row execute function store_operations_uat_private.reject_external_subject_mutation();

create function store_operations_uat_private.guard_external_binding_decision()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare prior store_operations_uat_private.external_subject_binding_decisions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('store-ops-external|'||new.binding_key::text,0));
  select * into prior from store_operations_uat_private.external_subject_binding_decisions
    where binding_key=new.binding_key order by decision_sequence desc limit 1;
  if not found then
    if new.decision_sequence<>1 or new.decision<>'grant' then raise exception 'STORE_OPERATIONS_EXTERNAL_SUBJECT_CHAIN_INVALID'; end if;
  elsif new.decision_sequence<>prior.decision_sequence+1 or new.decision=prior.decision
    or new.provider<>prior.provider or new.issuer<>prior.issuer or new.audience<>prior.audience
    or new.subject_fingerprint<>prior.subject_fingerprint or new.employee_id<>prior.employee_id then
    raise exception 'STORE_OPERATIONS_EXTERNAL_SUBJECT_CHAIN_INVALID';
  end if;
  if new.decision='grant' and exists (
    with latest as (
      select distinct on(binding_key) * from store_operations_uat_private.external_subject_binding_decisions
      where effective_at<=statement_timestamp() and (effective_to is null or statement_timestamp()<effective_to)
      order by binding_key,decision_sequence desc
    ) select 1 from latest where decision='grant' and
      ((provider=new.provider and issuer=new.issuer and audience=new.audience and subject_fingerprint=new.subject_fingerprint)
       or employee_id=new.employee_id)
  ) then raise exception 'STORE_OPERATIONS_EXTERNAL_SUBJECT_CONFLICT'; end if;
  return new;
end
$function$;

create trigger guard_external_binding_decision
before insert on store_operations_uat_private.external_subject_binding_decisions
for each row execute function store_operations_uat_private.guard_external_binding_decision();

create or replace function public.store_operations_uat_resolve_hub_employee_access_v1(p_employee_id uuid,p_as_of date)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare binding store_operations_uat_private.auth_identity_binding_decisions%rowtype;
  binding_count integer; role_key_value text; role_count integer; store_ids uuid[]; scope_mode text;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if not exists(select 1 from core.employee_identities i join core.employees e using(employee_id)
    where i.employee_id=p_employee_id and i.identity_status='active' and e.status='active'
      and e.effective_from<=p_as_of and (e.effective_to is null or p_as_of<e.effective_to))
  then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  with latest as (
    select distinct on(binding_key) * from store_operations_uat_private.auth_identity_binding_decisions
    where employee_id=p_employee_id and effective_at<=statement_timestamp()
    order by binding_key,decision_sequence desc
  ) select count(*) into binding_count from latest where decision='grant';
  if binding_count<>1 then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  select latest.* into binding from (
    select distinct on(binding_key) * from store_operations_uat_private.auth_identity_binding_decisions
    where employee_id=p_employee_id and effective_at<=statement_timestamp()
    order by binding_key,decision_sequence desc
  ) latest where latest.decision='grant';
  if not exists(select 1 from auth.users u where u.id=binding.auth_subject_id and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp()))
  then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  with latest as (
    select distinct on(attestation_key) * from store_operations_uat_private.role_attestation_decisions
    where employee_id=p_employee_id and audience='store_operations_staging_v1' and effective_at<=statement_timestamp()
    order by attestation_key,decision_sequence desc
  ) select count(*),min(role_key) into role_count,role_key_value from latest where decision='grant';
  if role_count<>1 then raise exception 'STORE_OPERATIONS_UAT_FORBIDDEN'; end if;
  if not exists(select 1 from accounting.current_consumer_access_contracts(
    binding.auth_subject_id,
    (select r.corporation_id from core.employee_store_assignments a
      join core.corporation_store_relationships r on r.store_id=a.store_id and r.relationship_type='accounting'
      where a.employee_id=p_employee_id and a.status='active' and a.effective_from<=p_as_of
        and (a.effective_to is null or p_as_of<a.effective_to) limit 1),p_as_of,'actual'))
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  if role_key_value='executive' then
    select array_agg(s.store_id order by s.store_code) into store_ids from projection.store_master_v1 s
      where s.in_official_population and s.is_active; scope_mode:='all';
  elsif role_key_value='area_manager' then
    select array_agg(distinct a.store_id order by a.store_id) into store_ids
      from core.employee_store_assignments a join projection.store_master_v1 s
        on s.store_id=a.store_id and s.in_official_population and s.is_active
      where a.employee_id=p_employee_id and a.status='active' and a.effective_from<=p_as_of
        and (a.effective_to is null or p_as_of<a.effective_to); scope_mode:='assigned';
  elsif role_key_value='store_manager' then
    select array_agg(a.store_id order by a.store_id) into store_ids
      from core.employee_store_assignments a join projection.store_master_v1 s
        on s.store_id=a.store_id and s.in_official_population and s.is_active
      where a.employee_id=p_employee_id and a.status='active' and a.assignment_kind='primary'
        and a.effective_from<=p_as_of and (a.effective_to is null or p_as_of<a.effective_to); scope_mode:='own';
  else raise exception 'STORE_OPERATIONS_UAT_FORBIDDEN'; end if;
  if coalesce(cardinality(store_ids),0)=0 or (role_key_value='executive' and cardinality(store_ids)<>20)
    or (role_key_value='store_manager' and cardinality(store_ids)<>1)
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  return jsonb_build_object('employeeId',p_employee_id,'roleKeys',jsonb_build_array(role_key_value),
    'scope',jsonb_build_object('mode',scope_mode,'storeIds',to_jsonb(store_ids)));
end
$function$;

create function public.store_operations_external_enrollment_issue_v1(
  p_challenge_hash text,p_artifact_digest text,p_identity_key text,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare approved store_operations_uat_private.approved_identities%rowtype; access jsonb;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_challenge_hash !~ '^[0-9a-f]{64}$' or p_identity_key<>'uat-executive'
    or p_expires_at<=statement_timestamp() or p_expires_at>statement_timestamp()+interval '10 minutes'
  then raise exception 'STORE_OPERATIONS_EXTERNAL_CHALLENGE_INVALID'; end if;
  select * into approved from store_operations_uat_private.approved_identities
    where artifact_digest=p_artifact_digest and identity_key=p_identity_key and role_key='executive'
      and status='approved' and effective_from<=current_date and (effective_to is null or current_date<effective_to);
  if not found then raise exception 'STORE_OPERATIONS_UAT_IDENTITY_NOT_APPROVED'; end if;
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(approved.employee_id,current_date);
  if access->>'employeeId'<>approved.employee_id::text or access#>>'{scope,mode}'<>'all'
    or jsonb_array_length(access#>'{scope,storeIds}')<>20 then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.external_subject_enrollment_challenges(
    challenge_hash,artifact_digest,identity_key,employee_id,approval_reference,expires_at
  ) values(p_challenge_hash,p_artifact_digest,p_identity_key,approved.employee_id,
    'approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1',p_expires_at);
  return jsonb_build_object('issued',true,'expiresAt',p_expires_at);
end
$function$;

create function public.store_operations_external_enrollment_consume_v1(
  p_challenge_hash text,p_provider text,p_issuer text,p_audience text,p_subject_fingerprint text,
  p_fingerprint_key_version integer,p_request_id uuid,p_effective_to timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare challenge store_operations_uat_private.external_subject_enrollment_challenges%rowtype; access jsonb;
  binding_key_value uuid:=gen_random_uuid(); consumed_at_value timestamptz:=statement_timestamp();
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_provider<>'google.com' or p_issuer<>'https://securetoken.google.com/idea-nov-group-portal'
    or p_audience<>'idea-nov-group-portal' or p_subject_fingerprint !~ '^[0-9a-f]{64}$'
    or p_fingerprint_key_version<>1 or p_effective_to<=consumed_at_value
    or p_effective_to>consumed_at_value+interval '14 days'
  then raise exception 'STORE_OPERATIONS_EXTERNAL_BINDING_INVALID'; end if;
  update store_operations_uat_private.external_subject_enrollment_challenges
    set consumed_at=consumed_at_value,request_id=p_request_id
    where challenge_hash=p_challenge_hash and identity_key='uat-executive' and consumed_at is null
      and expires_at>consumed_at_value
    returning * into challenge;
  if not found then raise exception 'STORE_OPERATIONS_EXTERNAL_CHALLENGE_DENIED'; end if;
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(challenge.employee_id,current_date);
  if access->>'employeeId'<>challenge.employee_id::text or access#>>'{scope,mode}'<>'all'
    or jsonb_array_length(access#>'{scope,storeIds}')<>20 then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.external_subject_binding_decisions(
    binding_key,decision_sequence,provider,issuer,audience,subject_fingerprint,fingerprint_key_version,
    employee_id,decision,effective_at,effective_to,evidence_reference,enrollment_challenge_id
  ) values(binding_key_value,1,p_provider,p_issuer,p_audience,p_subject_fingerprint,p_fingerprint_key_version,
    challenge.employee_id,'grant',consumed_at_value,p_effective_to,
    'approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1',challenge.challenge_id);
  return jsonb_build_object('bound',true,'employeeId',challenge.employee_id,'access',access);
end
$function$;

create function public.store_operations_external_subject_resolve_v1(
  p_provider text,p_issuer text,p_audience text,p_subject_fingerprint text,p_as_of timestamptz
) returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare match_count integer; matched store_operations_uat_private.external_subject_binding_decisions%rowtype; access jsonb;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  with latest as (
    select distinct on(binding_key) * from store_operations_uat_private.external_subject_binding_decisions
    where provider=p_provider and issuer=p_issuer and audience=p_audience and subject_fingerprint=p_subject_fingerprint
      and effective_at<=p_as_of and (effective_to is null or p_as_of<effective_to)
    order by binding_key,decision_sequence desc
  ) select count(*) into match_count from latest where decision='grant';
  if match_count<>1 then raise exception 'STORE_OPERATIONS_EXTERNAL_SUBJECT_DENIED'; end if;
  select latest.* into matched from (
    select distinct on(binding_key) * from store_operations_uat_private.external_subject_binding_decisions
    where provider=p_provider and issuer=p_issuer and audience=p_audience and subject_fingerprint=p_subject_fingerprint
      and effective_at<=p_as_of and (effective_to is null or p_as_of<effective_to)
    order by binding_key,decision_sequence desc
  ) latest where decision='grant';
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(matched.employee_id,p_as_of::date);
  return jsonb_build_object('employeeId',matched.employee_id,'access',access);
end
$function$;

revoke all on table store_operations_uat_private.external_subject_enrollment_challenges from public,anon,authenticated,service_role;
revoke all on table store_operations_uat_private.external_subject_binding_decisions from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.store_operations_external_subject_resolve_v1(text,text,text,text,timestamptz) from public,anon,authenticated;
grant select,insert,update on store_operations_uat_private.external_subject_enrollment_challenges to service_role;
grant select,insert on store_operations_uat_private.external_subject_binding_decisions to service_role;
grant execute on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz) to service_role;
grant execute on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz) to service_role;
grant execute on function public.store_operations_external_subject_resolve_v1(text,text,text,text,timestamptz) to service_role;

comment on table store_operations_uat_private.external_subject_binding_decisions is
  'Staging UAT-only append-only HMAC fingerprint to canonical employee decisions; no raw subject or PII.';
commit;
