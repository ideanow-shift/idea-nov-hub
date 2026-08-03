begin;

create table public.nov_talent_candidates_v1 (
  candidate_id uuid primary key default gen_random_uuid(),
  graduation_year smallint not null check (graduation_year between 2026 and 2035),
  student_name text not null check (char_length(btrim(student_name)) between 1 and 120),
  student_name_kana text check (student_name_kana is null or char_length(student_name_kana) <= 120),
  school_name text check (school_name is null or char_length(school_name) <= 180),
  faculty_name text check (faculty_name is null or char_length(faculty_name) <= 180),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  line_identifier text check (line_identifier is null or char_length(line_identifier) <= 160),
  current_status_code text check (current_status_code is null or current_status_code in (
    'LINE_REGISTERED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED','AWAITING_INTERVIEW',
    'OFFERED','OFFERED_ELSEWHERE','DROPPED','UNDER_REVIEW','REJECTED'
  )),
  acquisition_source text check (acquisition_source is null or char_length(acquisition_source) <= 180),
  assigned_to text check (assigned_to is null or char_length(assigned_to) <= 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  source_dataset_id uuid references public.nov_talent_candidate_datasets_v1(dataset_id) on delete restrict,
  source_type text check (source_type is null or source_type in ('CONTACTS_27','CONTACTS_28','NOV_TALENT_UI')),
  source_row_no integer check (source_row_no is null or source_row_no > 0),
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  invalidated_reason text check (invalidated_reason is null or char_length(invalidated_reason) between 1 and 500),
  invalidated_by_employee_id uuid,
  invalidated_at timestamptz,
  created_by_employee_id uuid not null,
  updated_by_employee_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_active and invalidated_reason is null and invalidated_by_employee_id is null and invalidated_at is null)
    or (not is_active and invalidated_reason is not null and invalidated_by_employee_id is not null and invalidated_at is not null)),
  unique (source_dataset_id, candidate_id)
);

create index nov_talent_candidates_v1_list on public.nov_talent_candidates_v1 (is_active, graduation_year, updated_at desc);
create index nov_talent_candidates_v1_email on public.nov_talent_candidates_v1 (lower(email)) where email is not null;

create table public.nov_talent_candidate_audit_log_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  action text not null check (action in ('CREATE','UPDATE','STATUS_CHANGE','DEACTIVATE','RESTORE')),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  before_values jsonb not null default '{}'::jsonb check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null default '{}'::jsonb check (jsonb_typeof(after_values) = 'object'),
  actor_employee_id uuid not null,
  actor_role text not null check (char_length(actor_role) between 1 and 80),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  candidate_version integer not null check (candidate_version > 0),
  occurred_at timestamptz not null default now()
);

create index nov_talent_candidate_audit_log_v1_candidate on public.nov_talent_candidate_audit_log_v1 (candidate_id, occurred_at desc);

create or replace function nov_talent_internal.block_candidate_audit_mutation_v1()
returns trigger language plpgsql set search_path = '' as $function$
begin
  raise exception using errcode = '55000', message = 'candidate_audit_log_append_only';
end
$function$;

create trigger block_nov_talent_candidate_audit_update_v1
before update or delete on public.nov_talent_candidate_audit_log_v1
for each row execute function nov_talent_internal.block_candidate_audit_mutation_v1();

alter table public.nov_talent_candidates_v1 enable row level security;
alter table public.nov_talent_candidate_audit_log_v1 enable row level security;
revoke all on public.nov_talent_candidates_v1 from public, anon, authenticated, service_role;
revoke all on public.nov_talent_candidate_audit_log_v1 from public, anon, authenticated, service_role;
grant select, insert, update on public.nov_talent_candidates_v1 to service_role;
grant select, insert on public.nov_talent_candidate_audit_log_v1 to service_role;

-- Bootstrap the operational layer from exactly one approved ACTIVE Candidate dataset.
do $block$
declare v_dataset_id uuid; v_expected integer; v_inserted integer;
begin
  select dataset_id, actual_candidate_count into strict v_dataset_id, v_expected
  from public.nov_talent_candidate_datasets_v1 where state = 'ACTIVE';
  if v_expected <> 636 then raise exception 'active_candidate_dataset_count_mismatch'; end if;
  insert into public.nov_talent_candidates_v1 (
    candidate_id, graduation_year, student_name, student_name_kana, school_name, faculty_name,
    phone, email, line_identifier, source_dataset_id, source_type, source_row_no,
    created_by_employee_id, updated_by_employee_id
  )
  select r.candidate_id, r.graduation_year, coalesce(nullif(btrim(r.student_name), ''), '氏名未登録'),
    r.student_name_kana, r.school_name, r.faculty_name, r.phone, lower(r.email), r.line_identifier,
    r.dataset_id, r.source_type, r.source_row_no,
    d.activated_by_employee_id, d.activated_by_employee_id
  from public.nov_talent_candidate_dataset_records_v1 r
  join public.nov_talent_candidate_datasets_v1 d on d.dataset_id = r.dataset_id
  where r.dataset_id = v_dataset_id;
  get diagnostics v_inserted = row_count;
  if v_inserted <> 636 then raise exception 'operational_candidate_bootstrap_count_mismatch'; end if;
end
$block$;

create or replace function public.nov_talent_create_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_graduation_year smallint,
  p_student_name text, p_student_name_kana text, p_school_name text, p_faculty_name text,
  p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.nov_talent_candidates_v1 (
    candidate_id, graduation_year, student_name, student_name_kana, school_name, faculty_name,
    phone, email, line_identifier, current_status_code, acquisition_source, assigned_to, notes,
    source_type, created_by_employee_id, updated_by_employee_id
  ) values (v_id, p_graduation_year, btrim(p_student_name), nullif(btrim(p_student_name_kana), ''),
    nullif(btrim(p_school_name), ''), nullif(btrim(p_faculty_name), ''), nullif(btrim(p_phone), ''),
    nullif(lower(btrim(p_email)), ''), nullif(btrim(p_line_identifier), ''), p_current_status_code,
    nullif(btrim(p_acquisition_source), ''), nullif(btrim(p_assigned_to), ''), nullif(btrim(p_notes), ''),
    'NOV_TALENT_UI', p_actor_employee_id, p_actor_employee_id);
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, after_values, actor_employee_id, actor_role, reason, candidate_version)
  values (v_id, 'CREATE', array['candidate'], '{}'::jsonb, p_actor_employee_id, p_actor_role, p_reason, 1);
  return query select v_id, 1;
end
$function$;

create or replace function public.nov_talent_update_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid, p_expected_version integer,
  p_graduation_year smallint, p_student_name text, p_student_name_kana text, p_school_name text,
  p_faculty_name text, p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new_version integer;
begin
  select * into strict v_old from public.nov_talent_candidates_v1 where nov_talent_candidates_v1.candidate_id = p_candidate_id and is_active for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='candidate_version_conflict'; end if;
  update public.nov_talent_candidates_v1 set graduation_year=p_graduation_year, student_name=btrim(p_student_name),
    student_name_kana=nullif(btrim(p_student_name_kana),''), school_name=nullif(btrim(p_school_name),''),
    faculty_name=nullif(btrim(p_faculty_name),''), phone=nullif(btrim(p_phone),''), email=nullif(lower(btrim(p_email)),''),
    line_identifier=nullif(btrim(p_line_identifier),''), current_status_code=p_current_status_code,
    acquisition_source=nullif(btrim(p_acquisition_source),''), assigned_to=nullif(btrim(p_assigned_to),''), notes=nullif(btrim(p_notes),''),
    version=version+1, updated_by_employee_id=p_actor_employee_id, updated_at=now()
  where nov_talent_candidates_v1.candidate_id=p_candidate_id returning version into v_new_version;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, actor_employee_id, actor_role, reason, candidate_version)
  values (p_candidate_id, case when v_old.current_status_code is distinct from p_current_status_code then 'STATUS_CHANGE' else 'UPDATE' end,
    array['candidate'], p_actor_employee_id, p_actor_role, p_reason, v_new_version);
  return query select p_candidate_id, v_new_version;
exception when no_data_found then raise exception using errcode='P0002', message='candidate_not_found';
end
$function$;

create or replace function public.nov_talent_set_candidate_active_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid,
  p_expected_version integer, p_active boolean
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = '' as $function$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new_version integer;
begin
  select * into strict v_old from public.nov_talent_candidates_v1 where nov_talent_candidates_v1.candidate_id=p_candidate_id for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='candidate_version_conflict'; end if;
  update public.nov_talent_candidates_v1 set is_active=p_active,
    invalidated_reason=case when p_active then null else p_reason end,
    invalidated_by_employee_id=case when p_active then null else p_actor_employee_id end,
    invalidated_at=case when p_active then null else now() end,
    version=version+1, updated_by_employee_id=p_actor_employee_id, updated_at=now()
  where nov_talent_candidates_v1.candidate_id=p_candidate_id returning version into v_new_version;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id, action, changed_fields, actor_employee_id, actor_role, reason, candidate_version)
  values (p_candidate_id, case when p_active then 'RESTORE' else 'DEACTIVATE' end,
    array['isActive'], p_actor_employee_id, p_actor_role, p_reason, v_new_version);
  return query select p_candidate_id, v_new_version;
exception when no_data_found then raise exception using errcode='P0002', message='candidate_not_found';
end
$function$;

revoke all on function public.nov_talent_create_candidate_v1(uuid,text,text,smallint,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.nov_talent_update_candidate_v1(uuid,text,text,uuid,integer,smallint,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.nov_talent_set_candidate_active_v1(uuid,text,text,uuid,integer,boolean) from public, anon, authenticated;
grant execute on function public.nov_talent_create_candidate_v1(uuid,text,text,smallint,text,text,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.nov_talent_update_candidate_v1(uuid,text,text,uuid,integer,smallint,text,text,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.nov_talent_set_candidate_active_v1(uuid,text,text,uuid,integer,boolean) to service_role;

comment on table public.nov_talent_candidates_v1 is 'Staging-only operational Candidate records. Browser access is prohibited; server-side API only.';
comment on table public.nov_talent_candidate_audit_log_v1 is 'Append-only Staging Candidate mutation audit log.';

commit;
