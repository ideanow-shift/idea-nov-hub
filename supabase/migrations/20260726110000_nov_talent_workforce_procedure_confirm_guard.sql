begin;

create or replace function public.assert_nov_talent_workforce_procedure_case_confirmable_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_completed integer;
begin
  if new.case_status <> 'CONFIRMED' then
    return new;
  end if;

  select count(*) into v_completed
  from (
    values
      ('ONBOARDING', 'BASIC_INFO'), ('ONBOARDING', 'DOCUMENTS'), ('ONBOARDING', 'APPROVAL'), ('ONBOARDING', 'CORE_HANDOFF'),
      ('TRANSFER', 'CHANGE_DETAILS'), ('TRANSFER', 'STAKEHOLDER_CONFIRMATION'), ('TRANSFER', 'APPROVAL'), ('TRANSFER', 'CORE_HANDOFF'),
      ('LEAVE', 'APPLICATION'), ('LEAVE', 'REQUIRED_PROCEDURES'), ('LEAVE', 'RETURN_PLAN'), ('LEAVE', 'CORE_HANDOFF'),
      ('RETIREMENT', 'RETIREMENT_DATE'), ('RETIREMENT', 'ASSET_RETURN'), ('RETIREMENT', 'DOCUMENTS'), ('RETIREMENT', 'CORE_HANDOFF')
  ) as d(procedure_type, step_key)
  join public.nov_talent_workforce_procedure_case_steps_v1 s
    on s.case_id = new.case_id and s.step_key = d.step_key and s.is_completed = true
  where d.procedure_type = new.procedure_type;

  if v_completed <> 4 then
    raise exception using errcode = '22023', message = 'procedure_case_checklist_incomplete';
  end if;
  return new;
end
$function$;

drop trigger if exists nov_talent_workforce_procedure_case_confirm_guard_v1
  on public.nov_talent_workforce_procedure_cases_v1;
create trigger nov_talent_workforce_procedure_case_confirm_guard_v1
before insert or update of case_status, procedure_type
on public.nov_talent_workforce_procedure_cases_v1
for each row execute function public.assert_nov_talent_workforce_procedure_case_confirmable_v1();

commit;
