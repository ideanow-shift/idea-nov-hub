begin;

-- Review-only rollback. It must never erase facts created under Outcome 1.
do $guard$
begin
  if exists (
    select 1 from public.nov_talent_selection_history_v1
    where source_type = 'NOV_TALENT_UI'
  ) or exists (
    select 1 from public.nov_talent_candidates_v1
    where current_status_projection_source = 'SELECTION_HISTORY'
  ) or exists (
    select 1 from public.nov_talent_recruitment_source_facts_v1
    where resolution_method is not null
       or evidence_reference is not null
       or evidence_hash is not null
  ) or exists (
    select 1 from public.nov_talent_recruitment_events_v1
    where event_code = 'COMMUNICATION_RECORDED'
  ) then
    raise exception using errcode = '55000',
      message = 'outcome1_rollback_business_facts_present';
  end if;
end
$guard$;

drop trigger if exists guard_official_recruitment_event_v1 on public.nov_talent_recruitment_events_v1;
drop trigger if exists guard_official_selection_append_v1 on public.nov_talent_selection_history_v1;
drop trigger if exists guard_source_fact_evidence_v2 on public.nov_talent_recruitment_source_facts_v1;
drop trigger if exists block_recruitment_activity_audit_mutation_v1 on public.nov_talent_recruitment_activity_audit_v1;

drop function if exists public.nov_talent_append_selection_transition_v1(
  uuid, text, text, uuid, integer, text, date, text, text
);
drop function if exists public.nov_talent_link_source_fact_v2(
  uuid, text, text, text, integer, text, uuid, integer, integer, text, text
);
drop function if exists nov_talent_internal.guard_official_recruitment_event_v1();
drop function if exists nov_talent_internal.guard_official_selection_append_v1();
drop function if exists nov_talent_internal.guard_source_fact_evidence_v2();
drop function if exists nov_talent_internal.block_recruitment_activity_audit_mutation_v1();
drop function if exists nov_talent_internal.candidate_audit_snapshot_v1(
  public.nov_talent_candidates_v1
);

drop index if exists public.nov_talent_candidates_v1_status_projection;
alter table public.nov_talent_candidates_v1
  drop constraint if exists nov_talent_candidates_v1_status_projection_shape,
  drop column if exists current_status_projected_at,
  drop column if exists current_status_selection_history_id,
  drop column if exists current_status_projection_source;

alter table public.nov_talent_recruitment_source_facts_v1
  drop column if exists resolution_method,
  drop column if exists evidence_hash,
  drop column if exists evidence_reference;

alter table public.nov_talent_recruitment_events_v1
  drop constraint if exists nov_talent_recruitment_events_v1_event_code_check,
  add constraint nov_talent_recruitment_events_v1_event_code_check check (event_code in (
    'CONTACT_RECORDED','LINE_REGISTERED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED',
    'INTERVIEW_PLANNED','INTERVIEW_COMPLETED'
  ));
alter table public.nov_talent_selection_history_v1
  drop constraint if exists nov_talent_selection_history_v1_selection_code_check,
  add constraint nov_talent_selection_history_v1_selection_code_check check (selection_code in (
    'APPLICATION_RECEIVED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED',
    'INTERVIEW_PLANNED','INTERVIEW_COMPLETED','UNDER_REVIEW','OFFERED',
    'OFFER_ACCEPTED','OFFERED_ELSEWHERE','WITHDRAWN','REJECTED'
  ));

create or replace function nov_talent_internal.candidate_audit_snapshot_v1(
  p_row public.nov_talent_candidates_v1
) returns jsonb language sql immutable set search_path = '' as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'graduationYear', p_row.graduation_year, 'displayName', p_row.student_name,
    'kana', p_row.student_name_kana, 'school', p_row.school_name, 'faculty', p_row.faculty_name,
    'phone', p_row.phone, 'email', p_row.email, 'lineIdentifier', p_row.line_identifier,
    'currentStatus', p_row.current_status_code, 'acquisitionSource', p_row.acquisition_source,
    'assignedTo', p_row.assigned_to, 'notes', p_row.notes, 'isActive', p_row.is_active
  ));
$function$;

create or replace function public.nov_talent_create_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_graduation_year smallint,
  p_student_name text, p_student_name_kana text, p_school_name text, p_faculty_name text,
  p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_row public.nov_talent_candidates_v1%rowtype;
begin
  insert into public.nov_talent_candidates_v1 (
    graduation_year,student_name,student_name_kana,school_name,faculty_name,phone,email,
    line_identifier,current_status_code,acquisition_source,assigned_to,notes,source_type,
    created_by_employee_id,updated_by_employee_id
  ) values (
    p_graduation_year,btrim(p_student_name),nullif(btrim(p_student_name_kana),''),
    nullif(btrim(p_school_name),''),nullif(btrim(p_faculty_name),''),nullif(btrim(p_phone),''),
    nullif(lower(btrim(p_email)),''),nullif(btrim(p_line_identifier),''),p_current_status_code,
    nullif(btrim(p_acquisition_source),''),nullif(btrim(p_assigned_to),''),nullif(btrim(p_notes),''),
    'NOV_TALENT_UI',p_actor_employee_id,p_actor_employee_id
  ) returning * into v_row;
  insert into public.nov_talent_candidate_audit_log_v1 (
    candidate_id,action,changed_fields,before_values,after_values,
    actor_employee_id,actor_role,reason,candidate_version
  ) values (
    v_row.candidate_id,'CREATE',array['candidate'],'{}'::jsonb,
    nov_talent_internal.candidate_audit_snapshot_v1(v_row),
    p_actor_employee_id,p_actor_role,p_reason,v_row.version
  );
  return query select v_row.candidate_id,v_row.version;
end
$function$;

create or replace function public.nov_talent_update_candidate_v1(
  p_actor_employee_id uuid,p_actor_role text,p_reason text,p_candidate_id uuid,p_expected_version integer,
  p_graduation_year smallint,p_student_name text,p_student_name_kana text,p_school_name text,
  p_faculty_name text,p_phone text,p_email text,p_line_identifier text,p_current_status_code text,
  p_acquisition_source text,p_assigned_to text,p_notes text
) returns table(candidate_id uuid,candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new public.nov_talent_candidates_v1%rowtype;
begin
  select * into strict v_old from public.nov_talent_candidates_v1
    where nov_talent_candidates_v1.candidate_id=p_candidate_id and is_active for update;
  if v_old.version<>p_expected_version then
    raise exception using errcode='40001',message='candidate_version_conflict';
  end if;
  update public.nov_talent_candidates_v1 set
    graduation_year=p_graduation_year,student_name=btrim(p_student_name),
    student_name_kana=nullif(btrim(p_student_name_kana),''),
    school_name=nullif(btrim(p_school_name),''),faculty_name=nullif(btrim(p_faculty_name),''),
    phone=nullif(btrim(p_phone),''),email=nullif(lower(btrim(p_email)),''),
    line_identifier=nullif(btrim(p_line_identifier),''),current_status_code=p_current_status_code,
    acquisition_source=nullif(btrim(p_acquisition_source),''),
    assigned_to=nullif(btrim(p_assigned_to),''),notes=nullif(btrim(p_notes),''),
    version=version+1,updated_by_employee_id=p_actor_employee_id,updated_at=now()
  where nov_talent_candidates_v1.candidate_id=p_candidate_id returning * into v_new;
  insert into public.nov_talent_candidate_audit_log_v1 (
    candidate_id,action,changed_fields,before_values,after_values,
    actor_employee_id,actor_role,reason,candidate_version
  ) values (
    p_candidate_id,
    case when v_old.current_status_code is distinct from v_new.current_status_code then 'STATUS_CHANGE' else 'UPDATE' end,
    array['candidate'],nov_talent_internal.candidate_audit_snapshot_v1(v_old),
    nov_talent_internal.candidate_audit_snapshot_v1(v_new),
    p_actor_employee_id,p_actor_role,p_reason,v_new.version
  );
  return query select p_candidate_id,v_new.version;
exception when no_data_found then
  raise exception using errcode='P0002',message='candidate_not_found';
end
$function$;

alter table public.nov_talent_recruitment_events_v1 no force row level security;
alter table public.nov_talent_selection_history_v1 no force row level security;
alter table public.nov_talent_recruitment_source_facts_v1 no force row level security;
alter table public.nov_talent_recruitment_activity_audit_v1 no force row level security;
alter table public.nov_talent_candidates_v1 no force row level security;

grant select,insert,update on public.nov_talent_candidates_v1 to service_role;
grant select,insert,update on public.nov_talent_recruitment_events_v1 to service_role;
grant select,insert,update on public.nov_talent_selection_history_v1 to service_role;
grant select,insert,update,delete on public.nov_talent_recruitment_source_facts_v1 to service_role;
grant select,insert on public.nov_talent_recruitment_activity_audit_v1 to service_role;
grant execute on function public.nov_talent_link_source_fact_v1(
  uuid,text,text,text,integer,text,uuid,integer
) to service_role;

comment on column public.nov_talent_candidates_v1.current_status_code is null;
comment on table public.nov_talent_recruitment_events_v1 is
  'Staging-only normalized recruitment event facts for NOV Talent dashboard and Candidate history.';
comment on table public.nov_talent_selection_history_v1 is
  'Staging-only normalized selection history facts for NOV Talent dashboard and Candidate history.';
comment on table public.nov_talent_recruitment_source_facts_v1 is
  'Staging-only aggregate recruitment facts from formal source sheets. Contains no candidate personal values and is available only to the server-side API.';

commit;
