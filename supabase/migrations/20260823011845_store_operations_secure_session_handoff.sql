begin;

create schema if not exists store_operations_handoff;
revoke all on schema store_operations_handoff from public,anon,authenticated;

create table store_operations_handoff.codes (
  handoff_id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[A-Za-z0-9_-]{43}$'),
  employee_id uuid not null,
  hub_session_id uuid not null,
  hub_session_expires_at timestamptz not null,
  target text not null check (target='STORE_OPERATIONS_STAGING'),
  target_origin text not null check (target_origin='https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app'),
  audience text not null check (audience='store_operations_staging_handoff_v1'),
  state_hash text not null check (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  nonce_hash text not null check (nonce_hash ~ '^[A-Za-z0-9_-]{43}$'),
  request_id uuid not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  exchange_request_id uuid unique,
  created_at timestamptz not null default statement_timestamp(),
  check (expires_at>issued_at and expires_at<=issued_at+interval '60 seconds'),
  check (hub_session_expires_at>expires_at),
  check (consumed_at is null or consumed_at>=issued_at)
);

create table store_operations_handoff.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  handoff_id uuid references store_operations_handoff.codes(handoff_id) on delete restrict,
  request_id uuid not null,
  employee_id uuid,
  event_type text not null check (event_type in ('ISSUED','CONSUMED','REJECTED','CLEANED_UP')),
  occurred_at timestamptz not null default statement_timestamp(),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail)='object')
);

alter table store_operations_handoff.codes enable row level security;
alter table store_operations_handoff.codes force row level security;
alter table store_operations_handoff.audit_events enable row level security;
alter table store_operations_handoff.audit_events force row level security;
revoke all on all tables in schema store_operations_handoff from public,anon,authenticated;
revoke all on all sequences in schema store_operations_handoff from public,anon,authenticated;

create function public.store_operations_handoff_issue_v1(
  p_code_hash text,p_employee_id uuid,p_hub_session_id uuid,p_hub_session_expires_at timestamptz,
  p_target text,p_target_origin text,p_audience text,p_state_hash text,p_nonce_hash text,
  p_request_id uuid,p_issued_at timestamptz,p_expires_at timestamptz
) returns table(handoff_id uuid,expires_at timestamptz)
language plpgsql security invoker set search_path=pg_catalog,public
as $function$
declare v_id uuid;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_HANDOFF_SERVER_ONLY'; end if;
  if p_expires_at<=p_issued_at or p_expires_at>p_issued_at+interval '60 seconds'
    or p_hub_session_expires_at<=p_expires_at then raise exception 'STORE_OPERATIONS_HANDOFF_INVALID_LIFETIME'; end if;
  insert into store_operations_handoff.codes(
    code_hash,employee_id,hub_session_id,hub_session_expires_at,target,target_origin,audience,
    state_hash,nonce_hash,request_id,issued_at,expires_at
  ) values(
    p_code_hash,p_employee_id,p_hub_session_id,p_hub_session_expires_at,p_target,p_target_origin,p_audience,
    p_state_hash,p_nonce_hash,p_request_id,p_issued_at,p_expires_at
  ) returning codes.handoff_id into v_id;
  insert into store_operations_handoff.audit_events(handoff_id,request_id,employee_id,event_type,occurred_at,detail)
  values(v_id,p_request_id,p_employee_id,'ISSUED',p_issued_at,jsonb_build_object('target',p_target,'audience',p_audience));
  return query select v_id,p_expires_at;
end
$function$;

create function public.store_operations_handoff_consume_v1(
  p_code_hash text,p_state_hash text,p_nonce_hash text,p_target text,p_target_origin text,p_audience text,
  p_consumed_at timestamptz,p_exchange_request_id uuid
) returns table(employee_id uuid,hub_session_id uuid,hub_session_expires_at timestamptz,expires_at timestamptz)
language plpgsql security invoker set search_path=pg_catalog,public
as $function$
declare v_row store_operations_handoff.codes%rowtype;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_HANDOFF_SERVER_ONLY'; end if;
  update store_operations_handoff.codes c set consumed_at=p_consumed_at,exchange_request_id=p_exchange_request_id
   where c.code_hash=p_code_hash and c.state_hash=p_state_hash and c.nonce_hash=p_nonce_hash
     and c.target=p_target and c.target_origin=p_target_origin and c.audience=p_audience
     and c.consumed_at is null and c.expires_at>p_consumed_at and c.hub_session_expires_at>p_consumed_at
   returning c.* into v_row;
  if not found then return; end if;
  insert into store_operations_handoff.audit_events(handoff_id,request_id,employee_id,event_type,occurred_at,detail)
  values(v_row.handoff_id,p_exchange_request_id,v_row.employee_id,'CONSUMED',p_consumed_at,
    jsonb_build_object('target',v_row.target,'audience',v_row.audience));
  return query select v_row.employee_id,v_row.hub_session_id,v_row.hub_session_expires_at,v_row.expires_at;
end
$function$;

create function public.store_operations_uat_resolve_hub_employee_access_v1(p_employee_id uuid,p_as_of date)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare binding store_operations_uat_private.auth_identity_binding_decisions%rowtype;
  role_key_value text; store_ids uuid[]; scope_mode text;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'STORE_OPERATIONS_UAT_SERVER_ONLY'; end if;
  if not exists(select 1 from core.employee_identities i join core.employees e using(employee_id)
    where i.employee_id=p_employee_id and i.identity_status='active' and e.status='active'
      and e.effective_from<=p_as_of and (e.effective_to is null or p_as_of<e.effective_to))
  then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  select latest.* into binding from (
    select distinct on(binding_key) * from store_operations_uat_private.auth_identity_binding_decisions
    where employee_id=p_employee_id and effective_at<=statement_timestamp()
    order by binding_key,decision_sequence desc
  ) latest where latest.decision='grant';
  if not found then raise exception 'STORE_OPERATIONS_UAT_UNAUTHORIZED'; end if;
  select latest.role_key into role_key_value from (
    select distinct on(attestation_key) * from store_operations_uat_private.role_attestation_decisions
    where employee_id=p_employee_id and audience='store_operations_staging_v1' and effective_at<=statement_timestamp()
    order by attestation_key,decision_sequence desc
  ) latest where latest.decision='grant';
  if role_key_value is null then raise exception 'STORE_OPERATIONS_UAT_FORBIDDEN'; end if;
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

revoke all on function public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.store_operations_handoff_consume_v1(text,text,text,text,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date) from public,anon,authenticated;
grant usage on schema store_operations_handoff to service_role;
grant select,insert,update on all tables in schema store_operations_handoff to service_role;
grant execute on function public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,uuid,timestamptz,timestamptz) to service_role;
grant execute on function public.store_operations_handoff_consume_v1(text,text,text,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date) to service_role;

comment on schema store_operations_handoff is 'Private Staging-only NOV HUB to Store Operations one-time handoff boundary.';
commit;
