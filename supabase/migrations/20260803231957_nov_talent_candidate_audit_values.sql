begin;

create or replace function nov_talent_internal.candidate_audit_snapshot_v1(p_row public.nov_talent_candidates_v1)
returns jsonb language sql immutable set search_path = '' as $function$
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
    graduation_year, student_name, student_name_kana, school_name, faculty_name, phone, email,
    line_identifier, current_status_code, acquisition_source, assigned_to, notes, source_type,
    created_by_employee_id, updated_by_employee_id
  ) values (p_graduation_year, btrim(p_student_name), nullif(btrim(p_student_name_kana),''),
    nullif(btrim(p_school_name),''), nullif(btrim(p_faculty_name),''), nullif(btrim(p_phone),''),
    nullif(lower(btrim(p_email)),''), nullif(btrim(p_line_identifier),''), p_current_status_code,
    nullif(btrim(p_acquisition_source),''), nullif(btrim(p_assigned_to),''), nullif(btrim(p_notes),''),
    'NOV_TALENT_UI', p_actor_employee_id, p_actor_employee_id) returning * into v_row;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, before_values, after_values, actor_employee_id, actor_role, reason, candidate_version)
  values (v_row.candidate_id, 'CREATE', array['candidate'], '{}'::jsonb,
    nov_talent_internal.candidate_audit_snapshot_v1(v_row), p_actor_employee_id, p_actor_role, p_reason, v_row.version);
  return query select v_row.candidate_id, v_row.version;
end
$function$;

create or replace function public.nov_talent_update_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid, p_expected_version integer,
  p_graduation_year smallint, p_student_name text, p_student_name_kana text, p_school_name text,
  p_faculty_name text, p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new public.nov_talent_candidates_v1%rowtype;
begin
  select * into strict v_old from public.nov_talent_candidates_v1 where nov_talent_candidates_v1.candidate_id=p_candidate_id and is_active for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='candidate_version_conflict'; end if;
  update public.nov_talent_candidates_v1 set graduation_year=p_graduation_year, student_name=btrim(p_student_name),
    student_name_kana=nullif(btrim(p_student_name_kana),''), school_name=nullif(btrim(p_school_name),''),
    faculty_name=nullif(btrim(p_faculty_name),''), phone=nullif(btrim(p_phone),''), email=nullif(lower(btrim(p_email)),''),
    line_identifier=nullif(btrim(p_line_identifier),''), current_status_code=p_current_status_code,
    acquisition_source=nullif(btrim(p_acquisition_source),''), assigned_to=nullif(btrim(p_assigned_to),''), notes=nullif(btrim(p_notes),''),
    version=version+1, updated_by_employee_id=p_actor_employee_id, updated_at=now()
  where nov_talent_candidates_v1.candidate_id=p_candidate_id returning * into v_new;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, before_values, after_values, actor_employee_id, actor_role, reason, candidate_version)
  values (p_candidate_id, case when v_old.current_status_code is distinct from v_new.current_status_code then 'STATUS_CHANGE' else 'UPDATE' end,
    array['candidate'], nov_talent_internal.candidate_audit_snapshot_v1(v_old), nov_talent_internal.candidate_audit_snapshot_v1(v_new),
    p_actor_employee_id, p_actor_role, p_reason, v_new.version);
  return query select p_candidate_id, v_new.version;
exception when no_data_found then raise exception using errcode='P0002', message='candidate_not_found';
end
$function$;

create or replace function public.nov_talent_set_candidate_active_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid,
  p_expected_version integer, p_active boolean
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new public.nov_talent_candidates_v1%rowtype;
begin
  select * into strict v_old from public.nov_talent_candidates_v1 where nov_talent_candidates_v1.candidate_id=p_candidate_id for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='candidate_version_conflict'; end if;
  update public.nov_talent_candidates_v1 set is_active=p_active,
    invalidated_reason=case when p_active then null else p_reason end,
    invalidated_by_employee_id=case when p_active then null else p_actor_employee_id end,
    invalidated_at=case when p_active then null else now() end,
    version=version+1, updated_by_employee_id=p_actor_employee_id, updated_at=now()
  where nov_talent_candidates_v1.candidate_id=p_candidate_id returning * into v_new;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, before_values, after_values, actor_employee_id, actor_role, reason, candidate_version)
  values (p_candidate_id, case when p_active then 'RESTORE' else 'DEACTIVATE' end, array['isActive'],
    nov_talent_internal.candidate_audit_snapshot_v1(v_old), nov_talent_internal.candidate_audit_snapshot_v1(v_new),
    p_actor_employee_id, p_actor_role, p_reason, v_new.version);
  return query select p_candidate_id, v_new.version;
exception when no_data_found then raise exception using errcode='P0002', message='candidate_not_found';
end
$function$;

revoke all on function nov_talent_internal.candidate_audit_snapshot_v1(public.nov_talent_candidates_v1) from public, anon, authenticated;

commit;
