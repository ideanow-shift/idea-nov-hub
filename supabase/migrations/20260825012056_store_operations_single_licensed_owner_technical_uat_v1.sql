-- Owner-approved, Staging-only, single licensed Google identity technical UAT.
-- The browser receives only an opaque one-time challenge. Target role/scope are fixed server-side.
begin;

create table store_operations_uat_private.technical_assumption_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  challenge_hash text not null unique check (challenge_hash ~ '^[0-9a-f]{64}$'),
  scenario text not null check (scenario in ('area_manager','store_manager')),
  artifact_digest text not null,
  identity_key text not null check (identity_key in ('uat-area-manager','uat-store-manager')),
  employee_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_id uuid unique,
  created_at timestamptz not null default statement_timestamp(),
  foreign key (artifact_digest,identity_key)
    references store_operations_uat_private.approved_identities(artifact_digest,identity_key) on delete restrict,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);

create table store_operations_uat_private.technical_assumption_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  assumption_key uuid not null,
  decision_sequence integer not null check (decision_sequence in (1,2)),
  provider text not null check (provider='google.com'),
  issuer text not null check (issuer='https://securetoken.google.com/idea-nov-group-portal'),
  audience text not null check (audience='idea-nov-group-portal'),
  subject_fingerprint text not null check (subject_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_key_version integer not null check (fingerprint_key_version=1),
  scenario text not null check (scenario in ('area_manager','store_manager')),
  identity_key text not null check (identity_key in ('uat-area-manager','uat-store-manager')),
  employee_id uuid not null,
  decision text not null check (decision in ('grant','revoke')),
  effective_at timestamptz not null default statement_timestamp(),
  effective_to timestamptz,
  evidence_reference text not null check (evidence_reference='approval:OWNER-SINGLE-LICENSED-OWNER-TECHNICAL-UAT-2026-08-25-V1'),
  challenge_id uuid references store_operations_uat_private.technical_assumption_challenges(challenge_id) on delete restrict,
  unique (assumption_key,decision_sequence),
  check ((decision='grant' and decision_sequence=1 and challenge_id is not null and effective_to is not null)
    or (decision='revoke' and decision_sequence=2 and challenge_id is null and effective_to is null)),
  check (effective_to is null or (effective_to > effective_at and effective_to <= effective_at + interval '15 minutes'))
);

alter table store_operations_uat_private.technical_assumption_challenges enable row level security;
alter table store_operations_uat_private.technical_assumption_challenges force row level security;
alter table store_operations_uat_private.technical_assumption_decisions enable row level security;
alter table store_operations_uat_private.technical_assumption_decisions force row level security;

create function store_operations_uat_private.reject_technical_assumption_mutation()
returns trigger language plpgsql set search_path='' as $function$
begin raise exception 'STORE_OPERATIONS_TECHNICAL_ASSUMPTION_APPEND_ONLY'; end
$function$;
create trigger reject_technical_assumption_mutation
before update or delete on store_operations_uat_private.technical_assumption_decisions
for each row execute function store_operations_uat_private.reject_technical_assumption_mutation();

create function store_operations_uat_private.guard_technical_assumption_decision()
returns trigger language plpgsql set search_path='' as $function$
declare latest store_operations_uat_private.technical_assumption_decisions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('store-ops-technical|'||new.subject_fingerprint,0));
  if new.decision='grant' and exists (
    select 1 from (
      select distinct on (assumption_key) * from store_operations_uat_private.technical_assumption_decisions
      where subject_fingerprint=new.subject_fingerprint order by assumption_key,decision_sequence desc
    ) active where decision='grant' and effective_at<=statement_timestamp() and statement_timestamp()<effective_to
  ) then raise exception 'STORE_OPERATIONS_TECHNICAL_ASSUMPTION_OVERLAP'; end if;
  if new.decision='revoke' then
    select * into latest from store_operations_uat_private.technical_assumption_decisions
      where assumption_key=new.assumption_key order by decision_sequence desc limit 1;
    if not found or latest.decision<>'grant' or latest.decision_sequence<>1
      or latest.subject_fingerprint<>new.subject_fingerprint or latest.employee_id<>new.employee_id
      or latest.scenario<>new.scenario or latest.identity_key<>new.identity_key
    then raise exception 'STORE_OPERATIONS_TECHNICAL_ASSUMPTION_REVOKE_DENIED'; end if;
  end if;
  return new;
end
$function$;
create trigger guard_technical_assumption_decision before insert
on store_operations_uat_private.technical_assumption_decisions
for each row execute function store_operations_uat_private.guard_technical_assumption_decision();

create function public.store_operations_technical_assumption_issue_v1(
  p_challenge_hash text,p_scenario text,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare approved store_operations_uat_private.approved_identities%rowtype; access jsonb;
  expected_key text; expected_mode text;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_challenge_hash !~ '^[0-9a-f]{64}$' or p_scenario not in ('area_manager','store_manager')
    or p_expires_at<=statement_timestamp() or p_expires_at>statement_timestamp()+interval '10 minutes'
  then raise exception 'STORE_OPERATIONS_TECHNICAL_CHALLENGE_INVALID'; end if;
  expected_key:=case p_scenario when 'area_manager' then 'uat-area-manager' else 'uat-store-manager' end;
  expected_mode:=case p_scenario when 'area_manager' then 'assigned' else 'own' end;
  select * into strict approved from store_operations_uat_private.approved_identities
    where identity_key=expected_key and status='approved' and effective_from<=current_date
      and (effective_to is null or current_date<effective_to);
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(approved.employee_id,current_date);
  if access->>'employeeId'<>approved.employee_id::text or access#>>'{roleKeys,0}'<>p_scenario
    or jsonb_array_length(access->'roleKeys')<>1 or access#>>'{scope,mode}'<>expected_mode
    or jsonb_array_length(access#>'{scope,storeIds}')<>1
    or approved.expected_store_id is null or (access#>>'{scope,storeIds,0}')::uuid<>approved.expected_store_id
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.technical_assumption_challenges(
    challenge_hash,scenario,artifact_digest,identity_key,employee_id,expires_at
  ) values(p_challenge_hash,p_scenario,approved.artifact_digest,expected_key,approved.employee_id,p_expires_at);
  return jsonb_build_object('issued',true,'scenario',p_scenario,'expiresAt',p_expires_at);
end $function$;

create function public.store_operations_technical_assumption_consume_v1(
  p_challenge_hash text,p_provider text,p_issuer text,p_audience text,p_subject_fingerprint text,
  p_fingerprint_key_version integer,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare challenge store_operations_uat_private.technical_assumption_challenges%rowtype;
  access jsonb; assumption uuid:=gen_random_uuid(); consumed timestamptz:=statement_timestamp();
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if p_provider<>'google.com' or p_issuer<>'https://securetoken.google.com/idea-nov-group-portal'
    or p_audience<>'idea-nov-group-portal' or p_subject_fingerprint !~ '^[0-9a-f]{64}$'
    or p_fingerprint_key_version<>1 or p_request_id is null
  then raise exception 'STORE_OPERATIONS_TECHNICAL_ASSUMPTION_INVALID'; end if;
  update store_operations_uat_private.technical_assumption_challenges
    set consumed_at=consumed,request_id=p_request_id
    where challenge_hash=p_challenge_hash and consumed_at is null and expires_at>consumed
    returning * into challenge;
  if not found then raise exception 'STORE_OPERATIONS_TECHNICAL_CHALLENGE_DENIED'; end if;
  access:=public.store_operations_uat_resolve_hub_employee_access_v1(challenge.employee_id,current_date);
  if access->>'employeeId'<>challenge.employee_id::text or access#>>'{roleKeys,0}'<>challenge.scenario
    or jsonb_array_length(access->'roleKeys')<>1 or jsonb_array_length(access#>'{scope,storeIds}')<>1
    or access#>>'{scope,mode}'<>(case challenge.scenario when 'area_manager' then 'assigned' else 'own' end)
  then raise exception 'STORE_OPERATIONS_UAT_SCOPE_DENIED'; end if;
  insert into store_operations_uat_private.technical_assumption_decisions(
    assumption_key,decision_sequence,provider,issuer,audience,subject_fingerprint,fingerprint_key_version,
    scenario,identity_key,employee_id,decision,effective_at,effective_to,evidence_reference,challenge_id
  ) values(assumption,1,p_provider,p_issuer,p_audience,p_subject_fingerprint,p_fingerprint_key_version,
    challenge.scenario,challenge.identity_key,challenge.employee_id,'grant',consumed,consumed+interval '15 minutes',
    'approval:OWNER-SINGLE-LICENSED-OWNER-TECHNICAL-UAT-2026-08-25-V1',challenge.challenge_id);
  return jsonb_build_object('assumptionKey',assumption,'uatScenario',challenge.scenario,
    'employeeId',challenge.employee_id,'access',access);
end $function$;

create function public.store_operations_technical_assumption_validate_v1(
  p_assumption_key uuid,p_employee_id uuid,p_scenario text,p_as_of timestamptz
) returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare latest store_operations_uat_private.technical_assumption_decisions%rowtype;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  select * into latest from store_operations_uat_private.technical_assumption_decisions
    where assumption_key=p_assumption_key order by decision_sequence desc limit 1;
  return jsonb_build_object('active',found and latest.decision='grant' and latest.employee_id=p_employee_id
    and latest.scenario=p_scenario and latest.effective_at<=p_as_of and p_as_of<latest.effective_to);
end $function$;

create function public.store_operations_technical_assumption_revoke_v1(
  p_assumption_key uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare prior store_operations_uat_private.technical_assumption_decisions%rowtype;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'STORE_OPERATIONS_TECHNICAL_REVOKE_REASON_REQUIRED'; end if;
  select * into prior from store_operations_uat_private.technical_assumption_decisions
    where assumption_key=p_assumption_key order by decision_sequence desc limit 1;
  if not found or prior.decision<>'grant' then raise exception 'STORE_OPERATIONS_TECHNICAL_ASSUMPTION_REVOKE_DENIED'; end if;
  insert into store_operations_uat_private.technical_assumption_decisions(
    assumption_key,decision_sequence,provider,issuer,audience,subject_fingerprint,fingerprint_key_version,
    scenario,identity_key,employee_id,decision,effective_at,evidence_reference
  ) values(prior.assumption_key,2,prior.provider,prior.issuer,prior.audience,prior.subject_fingerprint,
    prior.fingerprint_key_version,prior.scenario,prior.identity_key,prior.employee_id,'revoke',statement_timestamp(),
    'approval:OWNER-SINGLE-LICENSED-OWNER-TECHNICAL-UAT-2026-08-25-V1');
  return jsonb_build_object('revoked',true,'scenario',prior.scenario);
end $function$;

-- Supersede the independent Google-account enrollment runtime. Historical rows remain immutable.
revoke all on function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz)
  from public,anon,authenticated,service_role;

revoke all on table store_operations_uat_private.technical_assumption_challenges from public,anon,authenticated,service_role;
revoke all on table store_operations_uat_private.technical_assumption_decisions from public,anon,authenticated,service_role;
grant select,insert,update on store_operations_uat_private.technical_assumption_challenges to service_role;
grant select,insert on store_operations_uat_private.technical_assumption_decisions to service_role;
revoke all on function public.store_operations_technical_assumption_issue_v1(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.store_operations_technical_assumption_consume_v1(text,text,text,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.store_operations_technical_assumption_validate_v1(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.store_operations_technical_assumption_revoke_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.store_operations_technical_assumption_issue_v1(text,text,timestamptz) to service_role;
grant execute on function public.store_operations_technical_assumption_consume_v1(text,text,text,text,text,integer,uuid) to service_role;
grant execute on function public.store_operations_technical_assumption_validate_v1(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.store_operations_technical_assumption_revoke_v1(uuid,text) to service_role;

commit;
