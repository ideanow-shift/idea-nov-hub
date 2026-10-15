-- Bounded NOV HUB LINE WORKS personal-message delivery path.
-- This migration does not alter or replay os.notifications or its queue view.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists os.line_works_personal_message_deliveries (
  id uuid primary key,
  actor_employee_id uuid not null references public.employees(id) on delete restrict,
  recipient_employee_id uuid not null references public.employees(id) on delete restrict,
  destination_id uuid not null references os.notification_destinations(id) on delete restrict,
  content_fingerprint text not null,
  message_text text not null,
  approval_expires_at timestamptz not null,
  status text not null default 'claimed',
  claimed_at timestamptz not null default now(),
  delivery_started_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_works_personal_message_fingerprint_check
    check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint line_works_personal_message_text_check
    check (message_text = '【接続テスト】脇田AI秘書からLINE WORKSへの送信テストです。返信・対応は不要です。'),
  constraint line_works_personal_message_status_check
    check (status in ('claimed', 'delivery_started', 'sent', 'failed_pre_delivery', 'delivery_unknown')),
  constraint line_works_personal_message_terminal_timestamp_check
    check (
      (status in ('claimed', 'delivery_started') and completed_at is null)
      or (status in ('sent', 'failed_pre_delivery', 'delivery_unknown') and completed_at is not null)
    )
);

create unique index if not exists uq_line_works_personal_message_recipient_content
  on os.line_works_personal_message_deliveries (recipient_employee_id, content_fingerprint);

create index if not exists idx_line_works_personal_message_status_created
  on os.line_works_personal_message_deliveries (status, created_at);

alter table os.line_works_personal_message_deliveries enable row level security;
alter table os.line_works_personal_message_deliveries force row level security;

revoke all on table os.line_works_personal_message_deliveries from public, anon, authenticated;
revoke all on table os.line_works_personal_message_deliveries from service_role;
grant select on table os.line_works_personal_message_deliveries to service_role;

create or replace function os.claim_line_works_personal_message_v1(
  p_intent_id uuid,
  p_actor_employee_id uuid,
  p_recipient_employee_id uuid,
  p_content_fingerprint text,
  p_message_text text,
  p_approval_expires_at timestamptz
)
returns table (
  claim_id uuid,
  claim_status text,
  duplicate boolean,
  recipient_employee_id uuid,
  destination_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_destination_id uuid;
  v_destination_count integer;
  v_recipient_count integer;
  v_existing os.line_works_personal_message_deliveries%rowtype;
begin
  if p_intent_id is null or p_actor_employee_id is null or p_recipient_employee_id is null then
    raise exception 'invalid personal-message claim identity' using errcode = '22023';
  end if;
  if p_approval_expires_at <= clock_timestamp() or p_approval_expires_at > clock_timestamp() + interval '6 minutes' then
    raise exception 'personal-message approval expired or exceeds allowed lifetime' using errcode = '22023';
  end if;
  if p_content_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid personal-message content fingerprint' using errcode = '22023';
  end if;
  if p_message_text <> '【接続テスト】脇田AI秘書からLINE WORKSへの送信テストです。返信・対応は不要です。' then
    raise exception 'personal-message text is outside the approved one-message gate' using errcode = '22023';
  end if;
  if not exists (
    select 1
      from public.employees actor
     where actor.id = p_actor_employee_id
       and actor.is_active is true
  ) then
    raise exception 'active actor employee was not found' using errcode = '22023';
  end if;
  select count(*)
    into v_recipient_count
    from public.employees recipient
   where recipient.is_active is true
     and recipient.full_name = '脇田 将樹';

  if v_recipient_count <> 1 or not exists (
    select 1
      from public.employees recipient
     where recipient.id = p_recipient_employee_id
       and recipient.is_active is true
       and recipient.full_name = '脇田 将樹'
  ) then
    raise exception 'unique approved recipient was not found' using errcode = '22023';
  end if;

  select count(*), (array_agg(destination.id order by destination.id))[1]
    into v_destination_count, v_destination_id
    from os.notification_destinations destination
   where destination.provider = 'line_works'
     and destination.target_type = 'employee'
     and destination.target_id = p_recipient_employee_id
     and destination.purpose = 'primary'
     and destination.is_active is true
     and nullif(btrim(destination.channel_id), '') is not null
     and destination.channel_id !~ '^[0-9]+$';

  if v_destination_count <> 1 or v_destination_id is null then
    raise exception 'approved employee must have exactly one active personal LINE WORKS destination' using errcode = '22023';
  end if;

  insert into os.line_works_personal_message_deliveries (
    id,
    actor_employee_id,
    recipient_employee_id,
    destination_id,
    content_fingerprint,
    message_text,
    approval_expires_at,
    status
  ) values (
    p_intent_id,
    p_actor_employee_id,
    p_recipient_employee_id,
    v_destination_id,
    p_content_fingerprint,
    p_message_text,
    p_approval_expires_at,
    'claimed'
  )
  on conflict do nothing
  returning * into v_existing;

  if v_existing.id is null then
    select delivery.*
      into v_existing
      from os.line_works_personal_message_deliveries delivery
     where delivery.id = p_intent_id;
    if v_existing.id is not null
       and (v_existing.recipient_employee_id <> p_recipient_employee_id
            or v_existing.content_fingerprint <> p_content_fingerprint
            or v_existing.message_text <> p_message_text) then
      raise exception 'personal-message intent conflict' using errcode = '23505';
    end if;
    if v_existing.id is null then
      select delivery.*
        into v_existing
        from os.line_works_personal_message_deliveries delivery
       where delivery.recipient_employee_id = p_recipient_employee_id
         and delivery.content_fingerprint = p_content_fingerprint
       order by delivery.created_at
       limit 1;
    end if;
    if v_existing.id is null
       or v_existing.recipient_employee_id <> p_recipient_employee_id
       or v_existing.content_fingerprint <> p_content_fingerprint
       or v_existing.message_text <> p_message_text then
      raise exception 'personal-message intent conflict' using errcode = '23505';
    end if;
    return query select v_existing.id, v_existing.status, true, v_existing.recipient_employee_id, v_existing.destination_id;
    return;
  end if;

  return query select v_existing.id, v_existing.status, false, v_existing.recipient_employee_id, v_existing.destination_id;
end;
$$;

create or replace function os.begin_line_works_personal_message_delivery_v1(p_claim_id uuid)
returns table (claim_id uuid, claim_status text, recipient_employee_id uuid, destination_id uuid, message_text text)
language sql
security definer
set search_path = pg_catalog
as $$
  update os.line_works_personal_message_deliveries delivery
     set status = 'delivery_started',
         delivery_started_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where delivery.id = p_claim_id
     and delivery.status = 'claimed'
     and delivery.approval_expires_at > clock_timestamp()
  returning delivery.id, delivery.status, delivery.recipient_employee_id, delivery.destination_id, delivery.message_text;
$$;

create or replace function os.finish_line_works_personal_message_delivery_v1(
  p_claim_id uuid,
  p_terminal_status text,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns table (claim_id uuid, claim_status text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_terminal_status not in ('sent', 'failed_pre_delivery', 'delivery_unknown') then
    raise exception 'invalid personal-message terminal status' using errcode = '22023';
  end if;
  if length(coalesce(p_provider_message_id, '')) > 200 or length(coalesce(p_error_code, '')) > 200 then
    raise exception 'personal-message result metadata is too long' using errcode = '22023';
  end if;

  if p_terminal_status = 'failed_pre_delivery' then
    return query
      update os.line_works_personal_message_deliveries delivery
         set status = p_terminal_status,
             error_code = nullif(p_error_code, ''),
             completed_at = clock_timestamp(),
             updated_at = clock_timestamp()
       where delivery.id = p_claim_id
         and delivery.status = 'claimed'
      returning delivery.id, delivery.status;
  else
    return query
      update os.line_works_personal_message_deliveries delivery
         set status = p_terminal_status,
             provider_message_id = case when p_terminal_status = 'sent' then nullif(p_provider_message_id, '') else null end,
             error_code = case when p_terminal_status = 'delivery_unknown' then nullif(p_error_code, '') else null end,
             sent_at = case when p_terminal_status = 'sent' then clock_timestamp() else null end,
             completed_at = clock_timestamp(),
             updated_at = clock_timestamp()
       where delivery.id = p_claim_id
         and delivery.status = 'delivery_started'
      returning delivery.id, delivery.status;
  end if;
end;
$$;

revoke all on function os.claim_line_works_personal_message_v1(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function os.begin_line_works_personal_message_delivery_v1(uuid) from public, anon, authenticated;
revoke all on function os.finish_line_works_personal_message_delivery_v1(uuid, text, text, text) from public, anon, authenticated;

grant execute on function os.claim_line_works_personal_message_v1(uuid, uuid, uuid, text, text, timestamptz) to service_role;
grant execute on function os.begin_line_works_personal_message_delivery_v1(uuid) to service_role;
grant execute on function os.finish_line_works_personal_message_delivery_v1(uuid, text, text, text) to service_role;

commit;
