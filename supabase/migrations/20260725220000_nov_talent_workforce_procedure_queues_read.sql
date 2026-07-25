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
  v_as_of_date date := current_date;
  v_result jsonb;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select jsonb_build_object(
    'active_employee_count', count(*) filter (where e.is_active = true),
    'onboarding_count', count(*) filter (where e.is_active = true and e.joined_on is not null and e.joined_on > v_as_of_date),
    'leave_count', count(*) filter (where e.is_active = true and e.leave_start_date is not null and e.leave_start_date <= v_as_of_date and (e.leave_end_date is null or e.leave_end_date >= v_as_of_date)),
    'retirement_count', count(*) filter (where e.retired_on is not null and e.retired_on >= v_as_of_date and e.retired_on <= v_as_of_date + 90),
    'transfer_count', null,
    'transfer_available', false,
    'as_of_date', v_as_of_date,
    'procedure_queues', jsonb_build_object(
      'onboarding', coalesce((
        select jsonb_agg(jsonb_build_object('display_name', queue.display_name, 'effective_date', queue.effective_date, 'detail', queue.detail) order by queue.effective_date, queue.display_name)
        from (
          select coalesce(nullif(trim(employee.full_name), ''), '氏名未登録') as display_name, employee.joined_on as effective_date, coalesce(nullif(trim(employee.employment_type), ''), '雇用区分未登録') as detail
          from public.employees employee
          where employee.is_active = true and employee.joined_on is not null and employee.joined_on > v_as_of_date
          order by employee.joined_on, employee.full_name
          limit 100
        ) queue
      ), '[]'::jsonb),
      'leave', coalesce((
        select jsonb_agg(jsonb_build_object('display_name', queue.display_name, 'effective_date', queue.effective_date, 'detail', queue.detail) order by queue.effective_date, queue.display_name)
        from (
          select coalesce(nullif(trim(employee.full_name), ''), '氏名未登録') as display_name, employee.leave_start_date as effective_date, coalesce(nullif(trim(employee.leave_type), ''), '休職中') as detail
          from public.employees employee
          where employee.is_active = true and employee.leave_start_date is not null and employee.leave_start_date <= v_as_of_date and (employee.leave_end_date is null or employee.leave_end_date >= v_as_of_date)
          order by employee.leave_start_date, employee.full_name
          limit 100
        ) queue
      ), '[]'::jsonb),
      'retirement', coalesce((
        select jsonb_agg(jsonb_build_object('display_name', queue.display_name, 'effective_date', queue.effective_date, 'detail', queue.detail) order by queue.effective_date, queue.display_name)
        from (
          select coalesce(nullif(trim(employee.full_name), ''), '氏名未登録') as display_name, employee.retired_on as effective_date, coalesce(nullif(trim(employee.employment_status), ''), '退職予定') as detail
          from public.employees employee
          where employee.retired_on is not null and employee.retired_on >= v_as_of_date and employee.retired_on <= v_as_of_date + 90
          order by employee.retired_on, employee.full_name
          limit 100
        ) queue
      ), '[]'::jsonb)
    )
  ) into v_result
  from public.employees e;

  return coalesce(v_result, jsonb_build_object(
    'active_employee_count', 0,
    'onboarding_count', 0,
    'leave_count', 0,
    'retirement_count', 0,
    'transfer_count', null,
    'transfer_available', false,
    'as_of_date', v_as_of_date,
    'procedure_queues', jsonb_build_object('onboarding', '[]'::jsonb, 'leave', '[]'::jsonb, 'retirement', '[]'::jsonb)
  ));
end
$function$;

revoke all on function public.get_nov_talent_workforce_summary_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_nov_talent_workforce_summary_v1(uuid) to service_role;

commit;
