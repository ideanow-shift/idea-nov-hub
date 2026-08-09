begin;

-- Review-only rollback. Outcome 2 facts are append-only and are never erased.
do $guard$
begin
  if exists (select 1 from public.nov_talent_recruitment_events_v1 where event_code='COMMUNICATION_RECORDED')
    or exists (select 1 from public.nov_talent_next_actions_v1 where workflow_contract_version='1.0.0')
    or exists (select 1 from public.nov_talent_recruitment_activity_audit_v1 where action in ('HOLD','REOPEN','CANCEL')) then
    raise exception using errcode='55000', message='outcome2_rollback_business_facts_present';
  end if;
end
$guard$;

drop trigger if exists guard_next_action_command_v2 on public.nov_talent_next_actions_v1;
drop function if exists public.nov_talent_record_communication_v1(uuid,text,text,uuid,integer,timestamptz,text,text,text,text,boolean,boolean,text,date,text,text);
drop function if exists public.nov_talent_mutate_next_action_v2(uuid,text,text,text,uuid,uuid,integer,text,date,text,text,text);
drop function if exists nov_talent_internal.guard_next_action_command_v2();

alter table public.nov_talent_next_actions_v1
  drop constraint if exists nov_talent_next_actions_v1_hold_reason_check,
  drop constraint if exists nov_talent_next_actions_v1_creation_basis_check,
  drop constraint if exists nov_talent_next_actions_v1_workflow_contract_check,
  drop constraint if exists nov_talent_next_actions_v1_state_check,
  drop column if exists origin_event_id,
  drop column if exists assigned_employee_id,
  drop column if exists creation_basis,
  drop column if exists workflow_contract_version,
  drop column if exists cancelled_at,
  drop column if exists held_at,
  drop column if exists hold_reason,
  add constraint nov_talent_next_actions_v1_state_check check (state in ('OPEN','COMPLETED','CANCELLED'));

alter table public.nov_talent_recruitment_events_v1
  drop constraint if exists nov_talent_communication_shape_check,
  drop constraint if exists nov_talent_communication_result_check,
  drop constraint if exists nov_talent_communication_direction_check,
  drop constraint if exists nov_talent_communication_method_check,
  drop column if exists correction_reason,
  drop column if exists correction_of_event_id,
  drop column if exists next_follow_up_date,
  drop column if exists awaiting_reply,
  drop column if exists communication_result,
  drop column if exists communication_direction,
  drop column if exists communication_method,
  drop column if exists communication_at;

create or replace function nov_talent_internal.guard_official_recruitment_event_v1()
returns trigger language plpgsql set search_path = '' as $function$
declare
  v_allowed constant text[] := array['CONTACT_RECORDED','LINE_REGISTERED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED','COMMUNICATION_RECORDED'];
begin
  if tg_op='DELETE' then raise exception using errcode='55000',message='recruitment_event_physical_delete_forbidden'; end if;
  if tg_op='INSERT' and not (new.event_code=any(v_allowed)) then
    raise exception using errcode='23514',message='event_fact_domain_invalid';
  end if;
  if tg_op='UPDATE' then
    if old.event_code=any(v_allowed) then
      if not (new.event_code=any(v_allowed)) then raise exception using errcode='23514',message='event_fact_domain_invalid'; end if;
    elsif new.event_code is distinct from old.event_code or new.candidate_id is distinct from old.candidate_id
      or new.event_date is distinct from old.event_date or new.event_name is distinct from old.event_name
      or new.event_state is distinct from old.event_state or new.contact_content is distinct from old.contact_content
      or new.assigned_to is distinct from old.assigned_to or new.notes is distinct from old.notes then
      raise exception using errcode='55000',message='legacy_event_fact_read_only';
    end if;
  end if;
  return new;
end
$function$;

alter table public.nov_talent_recruitment_activity_audit_v1
  drop constraint if exists nov_talent_recruitment_activity_audit_v1_entity_type_check,
  drop constraint if exists nov_talent_recruitment_activity_audit_v1_action_check,
  add constraint nov_talent_recruitment_activity_audit_v1_entity_type_check
    check (entity_type in ('EVENT','SELECTION','NEXT_ACTION','SOURCE_FACT_LINK')),
  add constraint nov_talent_recruitment_activity_audit_v1_action_check
    check (action in ('CREATE','UPDATE','COMPLETE','DEACTIVATE','RESTORE','LINK'));

revoke all on public.nov_talent_next_actions_v1 from public,anon,authenticated,service_role;
grant select,insert,update on public.nov_talent_next_actions_v1 to service_role;

commit;
