begin;

create table if not exists public.nov_talent_workforce_procedure_cases_v1 (
  case_id uuid primary key default gen_random_uuid(),
  procedure_type text not null check (procedure_type in (
    'ONBOARDING', 'TRANSFER', 'LEAVE', 'RETIREMENT'
  )),
  case_status text not null check (case_status in (
    'DRAFT', 'READY_FOR_REVIEW', 'CONFIRMED', 'CANCELLED'
  )),
  subject_label text not null check (char_length(subject_label) between 1 and 120),
  effective_date date not null,
  detail text check (detail is null or char_length(detail) <= 500),
  version integer not null default 1 check (version >= 1),
  created_by_employee_id uuid not null,
  updated_by_employee_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nov_talent_workforce_procedure_cases_v1_updated_at_idx
  on public.nov_talent_workforce_procedure_cases_v1 (updated_at desc, case_id);

create table if not exists public.nov_talent_workforce_procedure_case_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.nov_talent_workforce_procedure_cases_v1(case_id) on delete restrict,
  action text not null check (action in ('CREATE', 'UPDATE')),
  changed_fields text[] not null check (cardinality(changed_fields) between 1 and 5),
  actor_employee_id uuid not null,
  case_version integer not null check (case_version >= 1),
  occurred_at timestamptz not null default now()
);

revoke all on table public.nov_talent_workforce_procedure_cases_v1 from public, anon, authenticated;
revoke all on table public.nov_talent_workforce_procedure_case_audit_v1 from public, anon, authenticated;

create or replace function public.get_nov_talent_workforce_procedure_cases_v1(
  p_employee_id uuid,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode = '22023', message = 'invalid_case_limit';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'case_id', c.case_id,
    'procedure_type', c.procedure_type,
    'case_status', c.case_status,
    'subject_label', c.subject_label,
    'effective_date', c.effective_date,
    'detail', c.detail,
    'version', c.version,
    'updated_at', c.updated_at
  ) order by c.updated_at desc, c.case_id), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.nov_talent_workforce_procedure_cases_v1
    order by updated_at desc, case_id
    limit p_limit
  ) c;

  return jsonb_build_object('cases', v_rows);
end
$function$;

create or replace function public.save_nov_talent_workforce_procedure_case_v1(
  p_actor_employee_id uuid,
  p_case_id uuid,
  p_expected_version integer,
  p_procedure_type text,
  p_case_status text,
  p_subject_label text,
  p_effective_date date,
  p_detail text
)
returns table(
  case_id uuid,
  case_version integer,
  operation text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.nov_talent_workforce_procedure_cases_v1%rowtype;
  v_changed_fields text[] := '{}'::text[];
  v_operation text;
  v_version integer;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);

  p_procedure_type := upper(nullif(btrim(p_procedure_type), ''));
  p_case_status := upper(nullif(btrim(p_case_status), ''));
  p_subject_label := nullif(btrim(p_subject_label), '');
  p_detail := nullif(btrim(p_detail), '');

  if p_expected_version is null or p_expected_version < 0
    or p_procedure_type not in ('ONBOARDING', 'TRANSFER', 'LEAVE', 'RETIREMENT')
    or p_case_status not in ('DRAFT', 'READY_FOR_REVIEW', 'CONFIRMED', 'CANCELLED')
    or p_subject_label is null or char_length(p_subject_label) > 120
    or p_effective_date is null
    or (p_detail is not null and char_length(p_detail) > 500)
  then
    raise exception using errcode = '22023', message = 'invalid_procedure_case';
  end if;

  if p_case_id is null then
    if p_expected_version <> 0 then
      raise exception using errcode = '22023', message = 'invalid_case_create_version';
    end if;
    insert into public.nov_talent_workforce_procedure_cases_v1(
      procedure_type, case_status, subject_label, effective_date, detail,
      created_by_employee_id, updated_by_employee_id
    ) values (
      p_procedure_type, p_case_status, p_subject_label, p_effective_date, p_detail,
      p_actor_employee_id, p_actor_employee_id
    ) returning nov_talent_workforce_procedure_cases_v1.case_id, version
      into case_id, v_version;
    v_changed_fields := array['procedureType', 'caseStatus', 'subjectLabel', 'effectiveDate', 'detail'];
    v_operation := 'CREATE';
  else
    select c.* into strict v_existing
    from public.nov_talent_workforce_procedure_cases_v1 c
    where c.case_id = p_case_id
    for update;
    if v_existing.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'procedure_case_version_conflict';
    end if;
    if v_existing.procedure_type is distinct from p_procedure_type then v_changed_fields := array_append(v_changed_fields, 'procedureType'); end if;
    if v_existing.case_status is distinct from p_case_status then v_changed_fields := array_append(v_changed_fields, 'caseStatus'); end if;
    if v_existing.subject_label is distinct from p_subject_label then v_changed_fields := array_append(v_changed_fields, 'subjectLabel'); end if;
    if v_existing.effective_date is distinct from p_effective_date then v_changed_fields := array_append(v_changed_fields, 'effectiveDate'); end if;
    if v_existing.detail is distinct from p_detail then v_changed_fields := array_append(v_changed_fields, 'detail'); end if;
    if cardinality(v_changed_fields) = 0 then
      raise exception using errcode = '22023', message = 'procedure_case_unchanged';
    end if;
    update public.nov_talent_workforce_procedure_cases_v1
    set procedure_type = p_procedure_type,
      case_status = p_case_status,
      subject_label = p_subject_label,
      effective_date = p_effective_date,
      detail = p_detail,
      version = version + 1,
      updated_by_employee_id = p_actor_employee_id,
      updated_at = now()
    where nov_talent_workforce_procedure_cases_v1.case_id = p_case_id
      and version = p_expected_version
    returning version into v_version;
    if not found then
      raise exception using errcode = '40001', message = 'procedure_case_version_conflict';
    end if;
    case_id := p_case_id;
    v_operation := 'UPDATE';
  end if;

  insert into public.nov_talent_workforce_procedure_case_audit_v1(
    case_id, action, changed_fields, actor_employee_id, case_version
  ) values (case_id, v_operation, v_changed_fields, p_actor_employee_id, v_version);

  case_version := v_version;
  operation := v_operation;
  return next;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'procedure_case_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_workforce_procedure_cases_v1(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_workforce_procedure_cases_v1(uuid, integer)
  to service_role;

revoke all on function public.save_nov_talent_workforce_procedure_case_v1(
  uuid, uuid, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.save_nov_talent_workforce_procedure_case_v1(
  uuid, uuid, integer, text, text, text, date, text
) to service_role;

commit;
