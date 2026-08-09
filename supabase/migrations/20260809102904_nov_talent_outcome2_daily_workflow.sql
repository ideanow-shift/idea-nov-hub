begin;

-- Outcome 2 extends the existing Event and Next Action facts. It does not
-- create a second operational source of truth.
alter table public.nov_talent_recruitment_events_v1
  add column communication_at timestamptz,
  add column communication_method text,
  add column communication_direction text,
  add column communication_result text,
  add column awaiting_reply boolean,
  add column next_follow_up_date date,
  add column correction_of_event_id uuid references public.nov_talent_recruitment_events_v1(event_id) on delete restrict,
  add column correction_reason text,
  add constraint nov_talent_communication_method_check check (
    communication_method is null or communication_method in ('LINE','PHONE','EMAIL','IN_PERSON','SCHOOL_RELAY','OTHER')
  ),
  add constraint nov_talent_communication_direction_check check (
    communication_direction is null or communication_direction in ('INBOUND','OUTBOUND')
  ),
  add constraint nov_talent_communication_result_check check (
    communication_result is null or communication_result in ('REACHED','NO_RESPONSE','REPLY_RECEIVED','INFORMATION_SHARED','OTHER')
  ),
  add constraint nov_talent_communication_shape_check check (
    event_code <> 'COMMUNICATION_RECORDED' or (
      communication_at is not null and communication_method is not null
      and communication_direction is not null and communication_result is not null
      and awaiting_reply is not null and char_length(btrim(contact_content)) between 1 and 1000
      and notes is null
    )
  ),
  add constraint nov_talent_communication_correction_shape_check check (
    (correction_of_event_id is null and correction_reason is null)
    or (event_code='COMMUNICATION_RECORDED' and correction_of_event_id is not null
      and char_length(btrim(correction_reason)) between 1 and 500)
  );

create unique index nov_talent_communication_single_correction_idx
  on public.nov_talent_recruitment_events_v1(correction_of_event_id)
  where correction_of_event_id is not null;

alter table public.nov_talent_next_actions_v1
  drop constraint if exists nov_talent_next_actions_v1_state_check;
alter table public.nov_talent_next_actions_v1
  add column hold_reason text,
  add column held_at timestamptz,
  add column cancelled_at timestamptz,
  add column creation_basis text not null default 'MANUAL',
  add column workflow_contract_version text,
  add column origin_event_id uuid references public.nov_talent_recruitment_events_v1(event_id) on delete restrict,
  add column assigned_employee_id uuid,
  add constraint nov_talent_next_actions_v1_state_check check (state in ('OPEN','ON_HOLD','COMPLETED','CANCELLED')),
  add constraint nov_talent_next_actions_v1_creation_basis_check check (creation_basis in ('MANUAL','COMMUNICATION_FOLLOW_UP')),
  add constraint nov_talent_next_actions_v1_workflow_contract_check check (workflow_contract_version is null or workflow_contract_version='1.1.0'),
  add constraint nov_talent_next_actions_v1_assignee_check check (
    workflow_contract_version is null or (assigned_employee_id is not null and nullif(btrim(assigned_to),'') is not null)
  ),
  add constraint nov_talent_next_actions_v1_hold_reason_check check (
    (state = 'ON_HOLD' and char_length(btrim(hold_reason)) between 1 and 500 and held_at is not null)
    or (state <> 'ON_HOLD' and hold_reason is null and held_at is null)
  );

alter table public.nov_talent_recruitment_activity_audit_v1
  drop constraint if exists nov_talent_recruitment_activity_audit_v1_entity_type_check,
  drop constraint if exists nov_talent_recruitment_activity_audit_v1_action_check;
alter table public.nov_talent_recruitment_activity_audit_v1
  add constraint nov_talent_recruitment_activity_audit_v1_entity_type_check
    check (entity_type in ('EVENT','COMMUNICATION','SELECTION','NEXT_ACTION','SOURCE_FACT_LINK')),
  add constraint nov_talent_recruitment_activity_audit_v1_action_check
    check (action in ('CREATE','UPDATE','ASSIGN','COMPLETE','HOLD','REOPEN','CANCEL','DEACTIVATE','RESTORE','LINK'));

create or replace function nov_talent_internal.guard_official_recruitment_event_v1()
returns trigger language plpgsql set search_path = '' as $function$
declare
  v_allowed constant text[] := array['CONTACT_RECORDED','LINE_REGISTERED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED','COMMUNICATION_RECORDED'];
begin
  if tg_op = 'DELETE' then
    raise exception using errcode='55000', message='recruitment_event_physical_delete_forbidden';
  end if;
  if tg_op = 'INSERT' then
    if not (new.event_code = any(v_allowed)) then
      raise exception using errcode='23514', message='event_fact_domain_invalid';
    end if;
    if new.event_code = 'COMMUNICATION_RECORDED'
      and current_setting('nov_talent.outcome2_communication_write', true) <> 'allowed' then
      raise exception using errcode='42501', message='communication_command_required';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.event_code = 'COMMUNICATION_RECORDED' or new.event_code = 'COMMUNICATION_RECORDED' then
      raise exception using errcode='55000', message='communication_append_only';
    end if;
    if old.event_code = any(v_allowed) then
      if not (new.event_code = any(v_allowed)) then
        raise exception using errcode='23514', message='event_fact_domain_invalid';
      end if;
    elsif new.event_code is distinct from old.event_code
      or new.candidate_id is distinct from old.candidate_id
      or new.event_date is distinct from old.event_date
      or new.event_name is distinct from old.event_name
      or new.event_state is distinct from old.event_state
      or new.contact_content is distinct from old.contact_content
      or new.assigned_to is distinct from old.assigned_to
      or new.notes is distinct from old.notes then
      raise exception using errcode='55000', message='legacy_event_fact_read_only';
    end if;
  end if;
  return new;
end
$function$;

create or replace function nov_talent_internal.guard_next_action_command_v2()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode='55000', message='next_action_physical_delete_forbidden';
  end if;
  if current_setting('nov_talent.outcome2_next_action_write', true) <> 'allowed' then
    raise exception using errcode='42501', message='next_action_command_required';
  end if;
  return new;
end
$function$;

drop trigger if exists guard_next_action_command_v2 on public.nov_talent_next_actions_v1;
create trigger guard_next_action_command_v2
before insert or update or delete on public.nov_talent_next_actions_v1
for each row execute function nov_talent_internal.guard_next_action_command_v2();

create or replace function public.nov_talent_record_communication_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text,
  p_candidate_id uuid, p_expected_candidate_version integer,
  p_communication_at text, p_method text, p_direction text, p_result text,
  p_summary text, p_awaiting_reply boolean,
  p_create_next_action boolean default false, p_next_action_code text default null,
  p_next_action_due_date date default null, p_next_action_text text default null,
  p_next_action_assigned_to text default null, p_next_action_assigned_employee_id uuid default null,
  p_corrects_communication_id uuid default null, p_correction_reason text default null
) returns table(event_id uuid, next_action_id uuid)
language plpgsql security definer set search_path = '' as $function$
declare
  v_role text := lower(coalesce(p_actor_role,''));
  v_candidate_version integer;
  v_event_id uuid := gen_random_uuid();
  v_action_id uuid;
  v_event jsonb;
  v_action jsonb;
  v_communication_at timestamptz;
  v_corrected public.nov_talent_recruitment_events_v1%rowtype;
begin
  if p_actor_employee_id is null or v_role not in ('super_admin','backoffice','hr.admin','hr.staff') then
    raise exception using errcode='42501', message='daily_workflow_write_forbidden';
  end if;
  if nullif(btrim(p_reason),'') is null or char_length(btrim(p_reason)) > 500 then
    raise exception using errcode='22023', message='reason_required';
  end if;
  if p_communication_at is null
    or p_communication_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-](0\d|1[0-4]):[0-5]\d)$'
    or p_method not in ('LINE','PHONE','EMAIL','IN_PERSON','SCHOOL_RELAY','OTHER')
    or p_direction not in ('INBOUND','OUTBOUND')
    or p_result not in ('REACHED','NO_RESPONSE','REPLY_RECEIVED','INFORMATION_SHARED','OTHER')
    or nullif(btrim(p_summary),'') is null or char_length(btrim(p_summary)) > 1000 then
    raise exception using errcode='22023', message='communication_payload_invalid';
  end if;
  begin
    v_communication_at := p_communication_at::timestamptz;
  exception when others then
    raise exception using errcode='22023', message='communication_timestamp_invalid';
  end;
  select version into strict v_candidate_version from public.nov_talent_candidates_v1
    where candidate_id=p_candidate_id and is_active for share;
  if v_candidate_version <> p_expected_candidate_version then
    raise exception using errcode='40001', message='candidate_version_conflict';
  end if;
  if p_create_next_action and (p_next_action_code not in ('FOLLOW_UP','SALON_TOUR_FOLLOW_UP','INTERVIEW_FOLLOW_UP','OFFER_FOLLOW_UP')
    or p_next_action_due_date is null or nullif(btrim(p_next_action_text),'') is null
    or p_next_action_assigned_employee_id is null or nullif(btrim(p_next_action_assigned_to),'') is null) then
    raise exception using errcode='22023', message='next_action_payload_invalid';
  end if;
  if (p_corrects_communication_id is null) <> (nullif(btrim(p_correction_reason),'') is null) then
    raise exception using errcode='22023', message='communication_correction_payload_invalid';
  end if;
  if p_corrects_communication_id is not null then
    select e.* into strict v_corrected from public.nov_talent_recruitment_events_v1 e
      where e.event_id=p_corrects_communication_id and e.candidate_id=p_candidate_id
        and e.event_code='COMMUNICATION_RECORDED' and e.is_active for share;
    if exists(select 1 from public.nov_talent_recruitment_events_v1 e
      where e.correction_of_event_id=p_corrects_communication_id and e.is_active) then
      raise exception using errcode='23505', message='communication_already_corrected';
    end if;
  end if;
  perform set_config('nov_talent.outcome2_communication_write','allowed',true);
  insert into public.nov_talent_recruitment_events_v1 (
    event_id,candidate_id,event_code,event_date,event_name,event_state,contact_content,assigned_to,notes,
    source_type,source_row_no,source_field_code,source_fingerprint,communication_at,communication_method,
    communication_direction,communication_result,awaiting_reply,next_follow_up_date,correction_of_event_id,correction_reason,
    created_by_employee_id,updated_by_employee_id
  ) values (
    v_event_id,p_candidate_id,'COMMUNICATION_RECORDED',(v_communication_at at time zone 'Asia/Tokyo')::date,
    '連絡記録','COMPLETED',btrim(p_summary),nullif(btrim(p_next_action_assigned_to),''),null,
    'NOV_TALENT_UI',null,'COMMUNICATION_RECORDED:'||v_event_id::text,null,v_communication_at,p_method,p_direction,p_result,
    p_awaiting_reply,case when p_create_next_action then p_next_action_due_date else null end,
    p_corrects_communication_id,nullif(btrim(p_correction_reason),''),p_actor_employee_id,p_actor_employee_id
  ) returning to_jsonb(nov_talent_recruitment_events_v1.*) into v_event;
  insert into public.nov_talent_recruitment_activity_audit_v1
    (candidate_id,entity_type,entity_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,entity_version)
  values (p_candidate_id,'COMMUNICATION',v_event_id::text,'CREATE',array['communication'],'{}',
    jsonb_build_object('eventCode','COMMUNICATION_RECORDED','method',p_method,'direction',p_direction,
      'result',p_result,'awaitingReply',p_awaiting_reply,'nextFollowUpDate',p_next_action_due_date,
      'correctsCommunicationId',p_corrects_communication_id,'correctionReason',nullif(btrim(p_correction_reason),'')),
    p_actor_employee_id,v_role,btrim(p_reason),1);
  if p_create_next_action then
    v_action_id := gen_random_uuid();
    perform set_config('nov_talent.outcome2_next_action_write','allowed',true);
    insert into public.nov_talent_next_actions_v1 (
      next_action_id,candidate_id,action_code,due_date,state,source_type,source_row_no,source_field_code,source_fingerprint,
      action_text,assigned_to,assigned_employee_id,notes,creation_basis,workflow_contract_version,origin_event_id,created_by_employee_id,updated_by_employee_id
    ) values (
      v_action_id,p_candidate_id,p_next_action_code,p_next_action_due_date,'OPEN','NOV_TALENT_UI',null,
      'NEXT_ACTION:'||v_action_id::text,null,btrim(p_next_action_text),btrim(p_next_action_assigned_to),p_next_action_assigned_employee_id,null,
      'COMMUNICATION_FOLLOW_UP','1.1.0',v_event_id,p_actor_employee_id,p_actor_employee_id
    ) returning to_jsonb(nov_talent_next_actions_v1.*) into v_action;
    insert into public.nov_talent_recruitment_activity_audit_v1
      (candidate_id,entity_type,entity_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,entity_version)
    values (p_candidate_id,'NEXT_ACTION',v_action_id::text,'CREATE',array['nextAction'],'{}',
      jsonb_build_object('actionCode',p_next_action_code,'dueDate',p_next_action_due_date,'state','OPEN',
        'creationBasis','COMMUNICATION_FOLLOW_UP','assignedEmployeeId',p_next_action_assigned_employee_id,
        'assignedTo',btrim(p_next_action_assigned_to)),
      p_actor_employee_id,v_role,btrim(p_reason),1);
  end if;
  return query select v_event_id,v_action_id;
exception when no_data_found then
  raise exception using errcode='P0002', message='candidate_not_found';
end
$function$;

create or replace function public.nov_talent_mutate_next_action_v2(
  p_actor_employee_id uuid, p_actor_role text, p_reason text,
  p_operation text, p_candidate_id uuid, p_next_action_id uuid,
  p_expected_version integer, p_action_code text, p_due_date date,
  p_action_text text, p_assigned_to text, p_assigned_employee_id uuid, p_hold_reason text default null
) returns table(next_action_id uuid, next_action_version integer)
language plpgsql security definer set search_path = '' as $function$
declare
  v_role text := lower(coalesce(p_actor_role,''));
  v_id uuid;
  v_before jsonb := '{}';
  v_after jsonb;
  v_old public.nov_talent_next_actions_v1%rowtype;
  v_action text;
  v_version integer;
begin
  if p_actor_employee_id is null or v_role not in ('super_admin','backoffice','hr.admin','hr.staff') then
    raise exception using errcode='42501', message='daily_workflow_write_forbidden';
  end if;
  if nullif(btrim(p_reason),'') is null or char_length(btrim(p_reason)) > 500 then
    raise exception using errcode='22023', message='reason_required';
  end if;
  if not exists(select 1 from public.nov_talent_candidates_v1 where candidate_id=p_candidate_id and is_active) then
    raise exception using errcode='P0002', message='candidate_not_found';
  end if;
  perform set_config('nov_talent.outcome2_next_action_write','allowed',true);
  if p_operation='CREATE' then
    if p_action_code not in ('FOLLOW_UP','SALON_TOUR_FOLLOW_UP','INTERVIEW_FOLLOW_UP','OFFER_FOLLOW_UP')
      or p_due_date is null or nullif(btrim(p_action_text),'') is null
      or p_assigned_employee_id is null or nullif(btrim(p_assigned_to),'') is null then
      raise exception using errcode='22023', message='next_action_payload_invalid';
    end if;
    v_id := gen_random_uuid();
    insert into public.nov_talent_next_actions_v1 (
      next_action_id,candidate_id,action_code,due_date,state,source_type,source_row_no,source_field_code,source_fingerprint,
      action_text,assigned_to,assigned_employee_id,notes,creation_basis,workflow_contract_version,created_by_employee_id,updated_by_employee_id
    ) values (v_id,p_candidate_id,p_action_code,p_due_date,'OPEN','NOV_TALENT_UI',null,'NEXT_ACTION:'||v_id::text,null,
      btrim(p_action_text),btrim(p_assigned_to),p_assigned_employee_id,null,'MANUAL','1.1.0',p_actor_employee_id,p_actor_employee_id)
    returning jsonb_build_object('actionCode',nov_talent_next_actions_v1.action_code,
      'dueDate',nov_talent_next_actions_v1.due_date,'state',nov_talent_next_actions_v1.state,
      'creationBasis',nov_talent_next_actions_v1.creation_basis,
      'assignedEmployeeId',nov_talent_next_actions_v1.assigned_employee_id,
      'assignedTo',nov_talent_next_actions_v1.assigned_to),version into v_after,v_version;
    v_action := 'CREATE';
  else
    select a.* into strict v_old from public.nov_talent_next_actions_v1 a
      where a.next_action_id=p_next_action_id and a.candidate_id=p_candidate_id for update;
    if v_old.version<>p_expected_version then raise exception using errcode='40001',message='next_action_version_conflict'; end if;
    if (p_operation='ASSIGN' and v_old.state in ('OPEN','ON_HOLD') and p_assigned_employee_id is not null
      and nullif(btrim(p_assigned_to),'') is not null) then v_action := 'ASSIGN';
    elsif (p_operation='COMPLETE' and v_old.state='OPEN') then v_action := 'COMPLETE';
    elsif (p_operation='HOLD' and v_old.state='OPEN' and nullif(btrim(p_hold_reason),'') is not null) then v_action := 'HOLD';
    elsif (p_operation='REOPEN' and v_old.state='ON_HOLD') then v_action := 'REOPEN';
    elsif (p_operation='CANCEL' and v_old.state in ('OPEN','ON_HOLD')) then v_action := 'CANCEL';
    else raise exception using errcode='22023',message='next_action_transition_invalid'; end if;
    v_before := jsonb_build_object('state',v_old.state,'version',v_old.version,
      'assignedEmployeeId',v_old.assigned_employee_id,'assignedTo',v_old.assigned_to);
    update public.nov_talent_next_actions_v1 set
      state=case p_operation when 'ASSIGN' then state when 'COMPLETE' then 'COMPLETED' when 'HOLD' then 'ON_HOLD' when 'REOPEN' then 'OPEN' else 'CANCELLED' end,
      assigned_to=case when p_operation='ASSIGN' then btrim(p_assigned_to) else assigned_to end,
      assigned_employee_id=case when p_operation='ASSIGN' then p_assigned_employee_id else assigned_employee_id end,
      completed_at=case when p_operation='COMPLETE' then now() else null end,
      hold_reason=case when p_operation='HOLD' then btrim(p_hold_reason) else null end,
      held_at=case when p_operation='HOLD' then now() else null end,
      cancelled_at=case when p_operation='CANCEL' then now() else null end,
      version=version+1,updated_at=now(),updated_by_employee_id=p_actor_employee_id
    where nov_talent_next_actions_v1.next_action_id=p_next_action_id
    returning nov_talent_next_actions_v1.next_action_id,nov_talent_next_actions_v1.version,
      jsonb_build_object('state',nov_talent_next_actions_v1.state,'version',nov_talent_next_actions_v1.version,
        'assignedEmployeeId',nov_talent_next_actions_v1.assigned_employee_id,'assignedTo',nov_talent_next_actions_v1.assigned_to)
      into v_id,v_version,v_after;
  end if;
  insert into public.nov_talent_recruitment_activity_audit_v1
    (candidate_id,entity_type,entity_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,entity_version)
  values (p_candidate_id,'NEXT_ACTION',v_id::text,v_action,array['nextAction'],v_before,v_after,p_actor_employee_id,v_role,btrim(p_reason),v_version);
  return query select v_id,v_version;
exception when no_data_found then raise exception using errcode='P0002',message='next_action_not_found';
end
$function$;

alter table public.nov_talent_next_actions_v1 force row level security;
revoke all on public.nov_talent_next_actions_v1 from public,anon,authenticated,service_role;
grant select on public.nov_talent_next_actions_v1 to service_role;
revoke all on function public.nov_talent_record_communication_v1(uuid,text,text,uuid,integer,text,text,text,text,text,boolean,boolean,text,date,text,text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.nov_talent_mutate_next_action_v2(uuid,text,text,text,uuid,uuid,integer,text,date,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.nov_talent_record_communication_v1(uuid,text,text,uuid,integer,text,text,text,text,text,boolean,boolean,text,date,text,text,uuid,uuid,text) to service_role;
grant execute on function public.nov_talent_mutate_next_action_v2(uuid,text,text,text,uuid,uuid,integer,text,date,text,text,uuid,text) to service_role;

comment on function public.nov_talent_record_communication_v1(uuid,text,text,uuid,integer,text,text,text,text,text,boolean,boolean,text,date,text,text,uuid,uuid,text) is
  'Outcome 2 append-only Communication command. Optionally creates one human-authorized follow-up Next Action in the same transaction.';
comment on function public.nov_talent_mutate_next_action_v2(uuid,text,text,text,uuid,uuid,integer,text,date,text,text,uuid,text) is
  'Outcome 2 Next Action lifecycle command with optimistic version and fail-closed transitions.';

commit;
