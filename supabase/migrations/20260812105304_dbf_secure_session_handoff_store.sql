begin;

create schema if not exists dbf_handoff;
revoke all on schema dbf_handoff from public;
revoke all on schema dbf_handoff from anon, authenticated;

create table dbf_handoff.codes (
  handoff_id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[A-Za-z0-9_-]{43}$'),
  employee_id uuid not null,
  hub_session_id uuid not null,
  hub_session_expires_at timestamptz not null,
  auth_source text not null check (auth_source in ('hub_session', 'hub_firebase')),
  target text not null check (target = 'DBF_STAGING'),
  target_origin text not null check (target_origin = 'https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app'),
  audience text not null check (audience = 'dbf_staging_handoff_exchange_v1'),
  state_hash text not null check (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  nonce_hash text not null check (nonce_hash ~ '^[A-Za-z0-9_-]{43}$'),
  request_id uuid not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (expires_at > issued_at and expires_at <= issued_at + interval '60 seconds'),
  check (hub_session_expires_at > issued_at),
  check (consumed_at is null or consumed_at >= issued_at)
);

create index dbf_handoff_codes_pending_idx
  on dbf_handoff.codes (expires_at)
  where consumed_at is null;
create index dbf_handoff_codes_session_idx
  on dbf_handoff.codes (hub_session_id, employee_id);

create table dbf_handoff.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  handoff_id uuid,
  request_id uuid not null,
  employee_id uuid,
  event_type text not null check (event_type in ('ISSUED', 'CONSUMED', 'CLEANED_UP')),
  occurred_at timestamptz not null default statement_timestamp(),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object')
);

create index dbf_handoff_audit_events_handoff_idx
  on dbf_handoff.audit_events (handoff_id, occurred_at desc);

alter table dbf_handoff.codes enable row level security;
alter table dbf_handoff.codes force row level security;
alter table dbf_handoff.audit_events enable row level security;
alter table dbf_handoff.audit_events force row level security;

revoke all on all tables in schema dbf_handoff from public, anon, authenticated;
revoke all on all sequences in schema dbf_handoff from public, anon, authenticated;

create or replace function public.dbf_staging_handoff_issue_v1(
  p_code_hash text,
  p_employee_id uuid,
  p_hub_session_id uuid,
  p_hub_session_expires_at timestamptz,
  p_auth_source text,
  p_target text,
  p_target_origin text,
  p_audience text,
  p_state_hash text,
  p_nonce_hash text,
  p_request_id uuid,
  p_issued_at timestamptz,
  p_expires_at timestamptz
) returns table (handoff_id uuid, expires_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if p_expires_at <= p_issued_at
     or p_expires_at > p_issued_at + interval '60 seconds'
     or p_hub_session_expires_at <= p_expires_at then
    raise exception 'invalid handoff lifetime' using errcode = '22023';
  end if;

  insert into dbf_handoff.codes (
    code_hash, employee_id, hub_session_id, hub_session_expires_at,
    auth_source, target, target_origin, audience, state_hash, nonce_hash,
    request_id, issued_at, expires_at
  ) values (
    p_code_hash, p_employee_id, p_hub_session_id, p_hub_session_expires_at,
    p_auth_source, p_target, p_target_origin, p_audience, p_state_hash,
    p_nonce_hash, p_request_id, p_issued_at, p_expires_at
  ) returning codes.handoff_id into v_id;

  insert into dbf_handoff.audit_events (
    handoff_id, request_id, employee_id, event_type, occurred_at,
    detail
  ) values (
    v_id, p_request_id, p_employee_id, 'ISSUED', p_issued_at,
    jsonb_build_object('target', p_target, 'audience', p_audience)
  );

  return query select v_id, p_expires_at;
end;
$$;

create or replace function public.dbf_staging_handoff_consume_v1(
  p_code_hash text,
  p_state_hash text,
  p_nonce_hash text,
  p_target text,
  p_target_origin text,
  p_audience text,
  p_consumed_at timestamptz,
  p_exchange_request_id uuid
) returns table (
  handoff_id uuid,
  employee_id uuid,
  hub_session_id uuid,
  hub_session_expires_at timestamptz,
  auth_source text,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row dbf_handoff.codes%rowtype;
begin
  update dbf_handoff.codes as c
     set consumed_at = p_consumed_at
   where c.code_hash = p_code_hash
     and c.state_hash = p_state_hash
     and c.nonce_hash = p_nonce_hash
     and c.target = p_target
     and c.target_origin = p_target_origin
     and c.audience = p_audience
     and c.consumed_at is null
     and c.expires_at > p_consumed_at
     and c.hub_session_expires_at > p_consumed_at
  returning c.* into v_row;

  if not found then
    return;
  end if;

  insert into dbf_handoff.audit_events (
    handoff_id, request_id, employee_id, event_type, occurred_at,
    detail
  ) values (
    v_row.handoff_id, p_exchange_request_id, v_row.employee_id,
    'CONSUMED', p_consumed_at,
    jsonb_build_object('target', v_row.target, 'audience', v_row.audience)
  );

  return query select
    v_row.handoff_id, v_row.employee_id, v_row.hub_session_id,
    v_row.hub_session_expires_at, v_row.auth_source, v_row.expires_at;
end;
$$;

create or replace function public.dbf_staging_handoff_cleanup_v1(
  p_before timestamptz,
  p_request_id uuid
) returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_count bigint;
begin
  with candidates as (
    select handoff_id, employee_id
      from dbf_handoff.codes
     where expires_at < p_before
       and (consumed_at is not null or expires_at < p_before - interval '1 day')
     for update
  ), audited as (
    insert into dbf_handoff.audit_events (
      handoff_id, request_id, employee_id, event_type, occurred_at, detail
    )
    select handoff_id, p_request_id, employee_id, 'CLEANED_UP',
           statement_timestamp(), '{}'::jsonb
      from candidates
    returning handoff_id
  )
  delete from dbf_handoff.codes c
   using audited a
   where c.handoff_id = a.handoff_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.dbf_staging_handoff_issue_v1(text, uuid, uuid, timestamptz, text, text, text, text, text, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.dbf_staging_handoff_consume_v1(text, text, text, text, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.dbf_staging_handoff_cleanup_v1(timestamptz, uuid) from public, anon, authenticated;
grant usage on schema dbf_handoff to service_role;
grant select, insert, update, delete on all tables in schema dbf_handoff to service_role;
grant execute on function public.dbf_staging_handoff_issue_v1(text, uuid, uuid, timestamptz, text, text, text, text, text, text, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.dbf_staging_handoff_consume_v1(text, text, text, text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.dbf_staging_handoff_cleanup_v1(timestamptz, uuid) to service_role;

comment on schema dbf_handoff is 'Private NOV HUB to DBF Staging one-time handoff store; never expose through browser Data API.';
comment on table dbf_handoff.codes is 'Hash-only, 60-second, single-use DBF Staging handoff codes.';
comment on function public.dbf_staging_handoff_consume_v1(text, text, text, text, text, text, timestamptz, uuid) is 'Security-invoker, service-role-only atomic one-time consume boundary.';

commit;
