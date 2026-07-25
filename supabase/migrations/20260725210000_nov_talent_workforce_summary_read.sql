begin;

create or replace function public.get_nov_talent_workforce_summary_v1(
  p_employee_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select jsonb_build_object(
    'active_employee_count', count(*) filter (where e.is_active = true),
    'onboarding_count', count(*) filter (
      where e.is_active = true and e.joined_on is not null and e.joined_on > current_date
    ),
    'leave_count', count(*) filter (
      where e.is_active = true
        and e.leave_start_date is not null
        and e.leave_start_date <= current_date
        and (e.leave_end_date is null or e.leave_end_date >= current_date)
    ),
    'retirement_count', count(*) filter (
      where e.retired_on is not null
        and e.retired_on >= current_date
        and e.retired_on <= current_date + 90
    ),
    'transfer_count', null,
    'transfer_available', false,
    'as_of_date', current_date
  )
  into v_result
  from public.employees e;

  return coalesce(v_result, jsonb_build_object(
    'active_employee_count', 0,
    'onboarding_count', 0,
    'leave_count', 0,
    'retirement_count', 0,
    'transfer_count', null,
    'transfer_available', false,
    'as_of_date', current_date
  ));
end
$function$;

revoke all on function public.get_nov_talent_workforce_summary_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_workforce_summary_v1(uuid)
  to service_role;

commit;
