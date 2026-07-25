begin;

create table if not exists public.nov_talent_workforce_procedure_case_steps_v1 (
  case_id uuid not null references public.nov_talent_workforce_procedure_cases_v1(case_id) on delete cascade,
  step_key text not null check (step_key in (
    'BASIC_INFO', 'DOCUMENTS', 'APPROVAL', 'CORE_HANDOFF',
    'CHANGE_DETAILS', 'STAKEHOLDER_CONFIRMATION',
    'APPLICATION', 'REQUIRED_PROCEDURES', 'RETURN_PLAN',
    'RETIREMENT_DATE', 'ASSET_RETURN'
  )),
  is_completed boolean not null default false,
  version integer not null default 1 check (version >= 1),
  updated_by_employee_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (case_id, step_key)
);

create table if not exists public.nov_talent_workforce_procedure_case_step_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  step_key text not null,
  action text not null check (action in ('COMPLETE', 'REOPEN')),
  actor_employee_id uuid not null,
  step_version integer not null check (step_version >= 1),
  occurred_at timestamptz not null default now(),
  foreign key (case_id, step_key) references public.nov_talent_workforce_procedure_case_steps_v1(case_id, step_key) on delete restrict
);

revoke all on table public.nov_talent_workforce_procedure_case_steps_v1 from public, anon, authenticated;
revoke all on table public.nov_talent_workforce_procedure_case_step_audit_v1 from public, anon, authenticated;

create or replace function public.get_nov_talent_workforce_procedure_case_steps_v1(
  p_employee_id uuid,
  p_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_procedure_type text;
  v_steps jsonb;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select c.procedure_type into strict v_procedure_type
  from public.nov_talent_workforce_procedure_cases_v1 c
  where c.case_id = p_case_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'step_key', d.step_key,
    'is_completed', coalesce(s.is_completed, false),
    'version', coalesce(s.version, 0),
    'updated_at', s.updated_at
  ) order by d.ordinal), '[]'::jsonb)
  into v_steps
  from (
    values
      ('ONBOARDING', 'BASIC_INFO', 1), ('ONBOARDING', 'DOCUMENTS', 2), ('ONBOARDING', 'APPROVAL', 3), ('ONBOARDING', 'CORE_HANDOFF', 4),
      ('TRANSFER', 'CHANGE_DETAILS', 1), ('TRANSFER', 'STAKEHOLDER_CONFIRMATION', 2), ('TRANSFER', 'APPROVAL', 3), ('TRANSFER', 'CORE_HANDOFF', 4),
      ('LEAVE', 'APPLICATION', 1), ('LEAVE', 'REQUIRED_PROCEDURES', 2), ('LEAVE', 'RETURN_PLAN', 3), ('LEAVE', 'CORE_HANDOFF', 4),
      ('RETIREMENT', 'RETIREMENT_DATE', 1), ('RETIREMENT', 'ASSET_RETURN', 2), ('RETIREMENT', 'DOCUMENTS', 3), ('RETIREMENT', 'CORE_HANDOFF', 4)
  ) as d(procedure_type, step_key, ordinal)
  left join public.nov_talent_workforce_procedure_case_steps_v1 s
    on s.case_id = p_case_id and s.step_key = d.step_key
  where d.procedure_type = v_procedure_type;

  return jsonb_build_object('procedure_type', v_procedure_type, 'steps', v_steps);
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'procedure_case_not_exact1';
end
$function$;

create or replace function public.save_nov_talent_workforce_procedure_case_step_v1(
  p_actor_employee_id uuid,
  p_case_id uuid,
  p_step_key text,
  p_is_completed boolean,
  p_expected_version integer
)
returns table(case_id uuid, step_key text, step_version integer, operation text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_procedure_type text;
  v_existing public.nov_talent_workforce_procedure_case_steps_v1%rowtype;
  v_version integer;
  v_operation text;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);
  p_step_key := upper(nullif(btrim(p_step_key), ''));
  if p_case_id is null or p_expected_version is null or p_expected_version < 0 or p_is_completed is null then
    raise exception using errcode = '22023', message = 'invalid_procedure_case_step';
  end if;

  select c.procedure_type into strict v_procedure_type
  from public.nov_talent_workforce_procedure_cases_v1 c
  where c.case_id = p_case_id
  for share;

  if not exists (
    select 1 from (values
      ('ONBOARDING', 'BASIC_INFO'), ('ONBOARDING', 'DOCUMENTS'), ('ONBOARDING', 'APPROVAL'), ('ONBOARDING', 'CORE_HANDOFF'),
      ('TRANSFER', 'CHANGE_DETAILS'), ('TRANSFER', 'STAKEHOLDER_CONFIRMATION'), ('TRANSFER', 'APPROVAL'), ('TRANSFER', 'CORE_HANDOFF'),
      ('LEAVE', 'APPLICATION'), ('LEAVE', 'REQUIRED_PROCEDURES'), ('LEAVE', 'RETURN_PLAN'), ('LEAVE', 'CORE_HANDOFF'),
      ('RETIREMENT', 'RETIREMENT_DATE'), ('RETIREMENT', 'ASSET_RETURN'), ('RETIREMENT', 'DOCUMENTS'), ('RETIREMENT', 'CORE_HANDOFF')
    ) as d(procedure_type, step_key)
    where d.procedure_type = v_procedure_type and d.step_key = p_step_key
  ) then
    raise exception using errcode = '22023', message = 'invalid_procedure_case_step';
  end if;

  select s.* into v_existing
  from public.nov_talent_workforce_procedure_case_steps_v1 s
  where s.case_id = p_case_id and s.step_key = p_step_key
  for update;

  if found then
    if v_existing.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'procedure_case_step_version_conflict';
    end if;
    if v_existing.is_completed = p_is_completed then
      raise exception using errcode = '22023', message = 'procedure_case_step_unchanged';
    end if;
    update public.nov_talent_workforce_procedure_case_steps_v1
    set is_completed = p_is_completed, version = version + 1,
      updated_by_employee_id = p_actor_employee_id, updated_at = now()
    where case_id = p_case_id and step_key = p_step_key and version = p_expected_version
    returning version into v_version;
  else
    if p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'procedure_case_step_version_conflict';
    end if;
    insert into public.nov_talent_workforce_procedure_case_steps_v1(
      case_id, step_key, is_completed, updated_by_employee_id
    ) values (p_case_id, p_step_key, p_is_completed, p_actor_employee_id)
    returning version into v_version;
  end if;

  v_operation := case when p_is_completed then 'COMPLETE' else 'REOPEN' end;
  insert into public.nov_talent_workforce_procedure_case_step_audit_v1(
    case_id, step_key, action, actor_employee_id, step_version
  ) values (p_case_id, p_step_key, v_operation, p_actor_employee_id, v_version);

  case_id := p_case_id;
  step_key := p_step_key;
  step_version := v_version;
  operation := v_operation;
  return next;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'procedure_case_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_workforce_procedure_case_steps_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_nov_talent_workforce_procedure_case_steps_v1(uuid, uuid) to service_role;
revoke all on function public.save_nov_talent_workforce_procedure_case_step_v1(uuid, uuid, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.save_nov_talent_workforce_procedure_case_step_v1(uuid, uuid, text, boolean, integer) to service_role;

commit;
