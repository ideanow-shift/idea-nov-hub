begin;

-- Staging-only operating model for Candidate-linked recruitment activity.
-- Browser roles never receive table or RPC privileges; the authenticated
-- NOV Talent Edge Function is the only caller.
alter table public.nov_talent_recruitment_events_v1
  drop constraint if exists nov_talent_recruitment_events_v1_source_type_check,
  drop constraint if exists nov_talent_recruitment_events_v1_source_row_no_check,
  drop constraint if exists nov_talent_recruitment_events_v1_source_fingerprint_check;
alter table public.nov_talent_recruitment_events_v1
  alter column source_row_no drop not null,
  alter column source_fingerprint drop not null,
  add column event_name text,
  add column event_state text not null default 'COMPLETED' check (event_state in ('PLANNED','COMPLETED')),
  add column contact_content text,
  add column assigned_to text,
  add column notes text,
  add column version integer not null default 1 check (version > 0),
  add column is_active boolean not null default true,
  add column created_by_employee_id uuid,
  add column updated_by_employee_id uuid,
  add column updated_at timestamptz not null default now(),
  add column invalidated_reason text,
  add column invalidated_by_employee_id uuid,
  add column invalidated_at timestamptz,
  add constraint nov_talent_recruitment_events_v1_source_type_check
    check (source_type in ('CONTACTS_27','CONTACTS_28','NOV_TALENT_UI')),
  add constraint nov_talent_recruitment_events_v1_source_row_no_check
    check (source_row_no is null or source_row_no > 0),
  add constraint nov_talent_recruitment_events_v1_source_fingerprint_check
    check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.nov_talent_selection_history_v1
  drop constraint if exists nov_talent_selection_history_v1_selection_code_check,
  drop constraint if exists nov_talent_selection_history_v1_source_type_check,
  drop constraint if exists nov_talent_selection_history_v1_source_row_no_check,
  drop constraint if exists nov_talent_selection_history_v1_source_fingerprint_check;
alter table public.nov_talent_selection_history_v1
  alter column source_row_no drop not null,
  alter column source_fingerprint drop not null,
  add column assigned_to text,
  add column notes text,
  add column version integer not null default 1 check (version > 0),
  add column is_active boolean not null default true,
  add column created_by_employee_id uuid,
  add column updated_by_employee_id uuid,
  add column updated_at timestamptz not null default now(),
  add column invalidated_reason text,
  add column invalidated_by_employee_id uuid,
  add column invalidated_at timestamptz,
  add constraint nov_talent_selection_history_v1_selection_code_check check (selection_code in (
    'APPLICATION_RECEIVED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED',
    'INTERVIEW_PLANNED','INTERVIEW_COMPLETED','UNDER_REVIEW','OFFERED',
    'OFFER_ACCEPTED','OFFERED_ELSEWHERE','WITHDRAWN','REJECTED'
  )),
  add constraint nov_talent_selection_history_v1_source_type_check
    check (source_type in ('CONTACTS_27','CONTACTS_28','ENTRIES_27','OFFERS_27','NOV_TALENT_UI')),
  add constraint nov_talent_selection_history_v1_source_row_no_check
    check (source_row_no is null or source_row_no > 0),
  add constraint nov_talent_selection_history_v1_source_fingerprint_check
    check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.nov_talent_next_actions_v1
  drop constraint if exists nov_talent_next_actions_v1_source_fingerprint_check;
alter table public.nov_talent_next_actions_v1
  alter column due_date drop not null,
  alter column source_fingerprint drop not null,
  add column action_text text,
  add column assigned_to text,
  add column notes text,
  add column completed_at timestamptz,
  add column version integer not null default 1 check (version > 0),
  add column is_active boolean not null default true,
  add column created_by_employee_id uuid,
  add column updated_by_employee_id uuid,
  add column updated_at timestamptz not null default now(),
  add column invalidated_reason text,
  add column invalidated_by_employee_id uuid,
  add column invalidated_at timestamptz,
  add constraint nov_talent_next_actions_v1_source_fingerprint_check
    check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.nov_talent_recruitment_source_facts_v1
  add column candidate_id uuid references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  add column linked_at timestamptz,
  add column linked_by_employee_id uuid,
  add column link_reason text,
  add column version integer not null default 1 check (version > 0);

create table public.nov_talent_recruitment_activity_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  entity_type text not null check (entity_type in ('EVENT','SELECTION','NEXT_ACTION','SOURCE_FACT_LINK')),
  entity_id text not null check (char_length(entity_id) between 1 and 200),
  action text not null check (action in ('CREATE','UPDATE','COMPLETE','DEACTIVATE','RESTORE','LINK')),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  actor_employee_id uuid not null,
  actor_role text not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  entity_version integer not null check (entity_version > 0),
  occurred_at timestamptz not null default now()
);
create index nov_talent_recruitment_activity_audit_candidate
  on public.nov_talent_recruitment_activity_audit_v1 (candidate_id, occurred_at desc);
alter table public.nov_talent_recruitment_activity_audit_v1 enable row level security;

revoke all on public.nov_talent_recruitment_activity_audit_v1 from public, anon, authenticated, service_role;
grant select, insert on public.nov_talent_recruitment_activity_audit_v1 to service_role;
grant update on public.nov_talent_recruitment_events_v1, public.nov_talent_selection_history_v1 to service_role;

create or replace function public.nov_talent_mutate_recruiting_activity_v1(
  p_actor_employee_id uuid,
  p_actor_role text,
  p_reason text,
  p_operation text,
  p_entity_type text,
  p_entity_id uuid,
  p_candidate_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns table(entity_id uuid, entity_version integer)
language plpgsql security definer set search_path = '' as $function$
declare
  v_id uuid;
  v_version integer;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_changed text[] := array['activity'];
  v_active boolean;
begin
  if lower(coalesce(p_actor_role,'')) not in ('super_admin','backoffice','hr.admin','hr.staff') then
    raise exception using errcode='42501', message='activity_write_forbidden';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023', message='reason_required'; end if;
  if not exists (select 1 from public.nov_talent_candidates_v1 where candidate_id=p_candidate_id and is_active) then
    raise exception using errcode='P0002', message='candidate_not_found';
  end if;

  if p_entity_type='EVENT' then
    if p_operation='CREATE' then
      insert into public.nov_talent_recruitment_events_v1
        (candidate_id,event_code,event_date,event_name,event_state,contact_content,assigned_to,notes,
         source_type,source_row_no,source_field_code,source_fingerprint,created_by_employee_id,updated_by_employee_id)
      values (p_candidate_id,p_payload->>'code',(p_payload->>'date')::date,nullif(btrim(p_payload->>'name'),''),
        coalesce(nullif(p_payload->>'state',''),'COMPLETED'),nullif(btrim(p_payload->>'content'),''),
        nullif(btrim(p_payload->>'assignedTo'),''),nullif(btrim(p_payload->>'notes'),''),
        'NOV_TALENT_UI',null,coalesce(nullif(p_payload->>'code',''),'CONTACT_RECORDED'),null,
        p_actor_employee_id,p_actor_employee_id)
      returning event_id,version,to_jsonb(nov_talent_recruitment_events_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(e.*),e.version,e.is_active into strict v_before,v_version,v_active
      from public.nov_talent_recruitment_events_v1 e where e.event_id=p_entity_id and e.candidate_id=p_candidate_id for update;
      if v_version<>p_expected_version then raise exception using errcode='40001',message='activity_version_conflict'; end if;
      if p_operation='UPDATE' then
        update public.nov_talent_recruitment_events_v1 set event_code=p_payload->>'code',event_date=(p_payload->>'date')::date,
          event_name=nullif(btrim(p_payload->>'name'),''),event_state=coalesce(nullif(p_payload->>'state',''),'COMPLETED'),
          contact_content=nullif(btrim(p_payload->>'content'),''),assigned_to=nullif(btrim(p_payload->>'assignedTo'),''),
          notes=nullif(btrim(p_payload->>'notes'),''),version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where event_id=p_entity_id returning event_id,version,to_jsonb(nov_talent_recruitment_events_v1.*) into v_id,v_version,v_after;
      elsif p_operation in ('DEACTIVATE','RESTORE') then
        update public.nov_talent_recruitment_events_v1 set is_active=(p_operation='RESTORE'),
          invalidated_reason=case when p_operation='RESTORE' then null else p_reason end,
          invalidated_by_employee_id=case when p_operation='RESTORE' then null else p_actor_employee_id end,
          invalidated_at=case when p_operation='RESTORE' then null else now() end,
          version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where event_id=p_entity_id returning event_id,version,to_jsonb(nov_talent_recruitment_events_v1.*) into v_id,v_version,v_after;
      else raise exception using errcode='22023',message='operation_invalid'; end if;
    end if;
  elsif p_entity_type='SELECTION' then
    if p_operation='CREATE' then
      insert into public.nov_talent_selection_history_v1
        (candidate_id,selection_code,effective_date,assigned_to,notes,source_type,source_row_no,source_field_code,
         source_fingerprint,created_by_employee_id,updated_by_employee_id)
      values (p_candidate_id,p_payload->>'code',(p_payload->>'date')::date,nullif(btrim(p_payload->>'assignedTo'),''),
        nullif(btrim(p_payload->>'notes'),''),'NOV_TALENT_UI',null,p_payload->>'code',null,p_actor_employee_id,p_actor_employee_id)
      returning selection_history_id,version,to_jsonb(nov_talent_selection_history_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(s.*),s.version,s.is_active into strict v_before,v_version,v_active
      from public.nov_talent_selection_history_v1 s where s.selection_history_id=p_entity_id and s.candidate_id=p_candidate_id for update;
      if v_version<>p_expected_version then raise exception using errcode='40001',message='activity_version_conflict'; end if;
      if p_operation='UPDATE' then
        update public.nov_talent_selection_history_v1 set selection_code=p_payload->>'code',effective_date=(p_payload->>'date')::date,
          assigned_to=nullif(btrim(p_payload->>'assignedTo'),''),notes=nullif(btrim(p_payload->>'notes'),''),
          version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where selection_history_id=p_entity_id returning selection_history_id,version,to_jsonb(nov_talent_selection_history_v1.*) into v_id,v_version,v_after;
      elsif p_operation in ('DEACTIVATE','RESTORE') then
        update public.nov_talent_selection_history_v1 set is_active=(p_operation='RESTORE'),
          invalidated_reason=case when p_operation='RESTORE' then null else p_reason end,
          invalidated_by_employee_id=case when p_operation='RESTORE' then null else p_actor_employee_id end,
          invalidated_at=case when p_operation='RESTORE' then null else now() end,
          version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where selection_history_id=p_entity_id returning selection_history_id,version,to_jsonb(nov_talent_selection_history_v1.*) into v_id,v_version,v_after;
      else raise exception using errcode='22023',message='operation_invalid'; end if;
    end if;
  elsif p_entity_type='NEXT_ACTION' then
    if p_operation='CREATE' then
      insert into public.nov_talent_next_actions_v1
        (candidate_id,action_code,due_date,action_text,assigned_to,notes,state,source_type,source_row_no,
         source_field_code,source_fingerprint,created_by_employee_id,updated_by_employee_id)
      values (p_candidate_id,coalesce(nullif(p_payload->>'code',''),'FOLLOW_UP'),nullif(p_payload->>'date','')::date,
        nullif(btrim(p_payload->>'content'),''),nullif(btrim(p_payload->>'assignedTo'),''),nullif(btrim(p_payload->>'notes'),''),
        coalesce(nullif(p_payload->>'state',''),'OPEN'),'NOV_TALENT_UI',null,'NEXT_ACTION',null,p_actor_employee_id,p_actor_employee_id)
      returning next_action_id,version,to_jsonb(nov_talent_next_actions_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(a.*),a.version,a.is_active into strict v_before,v_version,v_active
      from public.nov_talent_next_actions_v1 a where a.next_action_id=p_entity_id and a.candidate_id=p_candidate_id for update;
      if v_version<>p_expected_version then raise exception using errcode='40001',message='activity_version_conflict'; end if;
      if p_operation='UPDATE' then
        update public.nov_talent_next_actions_v1 set action_code=coalesce(nullif(p_payload->>'code',''),'FOLLOW_UP'),
          due_date=nullif(p_payload->>'date','')::date,action_text=nullif(btrim(p_payload->>'content'),''),
          assigned_to=nullif(btrim(p_payload->>'assignedTo'),''),notes=nullif(btrim(p_payload->>'notes'),''),
          state=coalesce(nullif(p_payload->>'state',''),'OPEN'),completed_at=case when p_payload->>'state'='COMPLETED' then now() else null end,
          version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where next_action_id=p_entity_id returning next_action_id,version,to_jsonb(nov_talent_next_actions_v1.*) into v_id,v_version,v_after;
      elsif p_operation='COMPLETE' then
        update public.nov_talent_next_actions_v1 set state='COMPLETED',completed_at=now(),version=version+1,
          updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where next_action_id=p_entity_id returning next_action_id,version,to_jsonb(nov_talent_next_actions_v1.*) into v_id,v_version,v_after;
      elsif p_operation in ('DEACTIVATE','RESTORE') then
        update public.nov_talent_next_actions_v1 set is_active=(p_operation='RESTORE'),
          invalidated_reason=case when p_operation='RESTORE' then null else p_reason end,
          invalidated_by_employee_id=case when p_operation='RESTORE' then null else p_actor_employee_id end,
          invalidated_at=case when p_operation='RESTORE' then null else now() end,
          version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
        where next_action_id=p_entity_id returning next_action_id,version,to_jsonb(nov_talent_next_actions_v1.*) into v_id,v_version,v_after;
      else raise exception using errcode='22023',message='operation_invalid'; end if;
    end if;
  else raise exception using errcode='22023',message='entity_type_invalid'; end if;

  insert into public.nov_talent_recruitment_activity_audit_v1
    (candidate_id,entity_type,entity_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,entity_version)
  values (p_candidate_id,p_entity_type,v_id::text,p_operation,v_changed,v_before,v_after,p_actor_employee_id,p_actor_role,p_reason,v_version);
  return query select v_id,v_version;
exception when no_data_found then raise exception using errcode='P0002',message='activity_not_found';
end
$function$;

create or replace function public.nov_talent_link_source_fact_v1(
  p_actor_employee_id uuid,p_actor_role text,p_reason text,p_source_type text,p_source_row_no integer,
  p_fact_code text,p_candidate_id uuid,p_expected_version integer
) returns table(source_row_no integer,source_version integer)
language plpgsql security definer set search_path='' as $function$
declare v_old public.nov_talent_recruitment_source_facts_v1%rowtype; v_new public.nov_talent_recruitment_source_facts_v1%rowtype;
begin
  if lower(coalesce(p_actor_role,'')) not in ('super_admin','backoffice','hr.admin','hr.staff') then
    raise exception using errcode='42501',message='source_fact_link_forbidden';
  end if;
  select * into strict v_old from public.nov_talent_recruitment_source_facts_v1 f
    where f.source_type=p_source_type and f.source_row_no=p_source_row_no and f.fact_code=p_fact_code for update;
  if v_old.version<>p_expected_version or v_old.candidate_id is not null then
    raise exception using errcode='40001',message='source_fact_version_conflict';
  end if;
  update public.nov_talent_recruitment_source_facts_v1 set candidate_id=p_candidate_id,linked_at=now(),
    linked_by_employee_id=p_actor_employee_id,link_reason=p_reason,version=version+1
  where nov_talent_recruitment_source_facts_v1.source_type=p_source_type
    and nov_talent_recruitment_source_facts_v1.source_row_no=p_source_row_no
    and nov_talent_recruitment_source_facts_v1.fact_code=p_fact_code returning * into v_new;
  insert into public.nov_talent_recruitment_activity_audit_v1
    (candidate_id,entity_type,entity_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,entity_version)
  values (p_candidate_id,'SOURCE_FACT_LINK',concat(p_source_type,':',p_source_row_no,':',p_fact_code),'LINK',array['candidateLink'],
    jsonb_build_object('linked',false),jsonb_build_object('linked',true),p_actor_employee_id,p_actor_role,p_reason,v_new.version);
  return query select v_new.source_row_no,v_new.version;
exception when no_data_found then raise exception using errcode='P0002',message='source_fact_not_found';
end
$function$;

revoke all on function public.nov_talent_mutate_recruiting_activity_v1(uuid,text,text,text,text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.nov_talent_link_source_fact_v1(uuid,text,text,text,integer,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.nov_talent_mutate_recruiting_activity_v1(uuid,text,text,text,text,uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.nov_talent_link_source_fact_v1(uuid,text,text,text,integer,text,uuid,integer) to service_role;

comment on table public.nov_talent_recruitment_activity_audit_v1 is
  'Append-only Staging audit history for Candidate-linked Event, Selection, Next Action, and manual source-fact linking.';

commit;
