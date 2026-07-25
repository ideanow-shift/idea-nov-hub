begin;

create or replace function public.get_nov_talent_student_profile_audit_v1(
  p_employee_id uuid,
  p_application_no text
)
returns table(
  action text,
  changed_fields text[],
  profile_version integer,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_application_id uuid;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);
  p_application_no := nullif(btrim(p_application_no), '');
  if p_application_no is null or p_application_no !~ '^NT-[0-9]{4}-[0-9]{6}$' then
    raise exception using errcode = '22023', message = 'invalid_application_no';
  end if;

  select a.application_id
  into strict v_application_id
  from public.nov_talent_applications_v1 a
  where a.application_no = p_application_no;

  return query
  select h.action, h.changed_fields, h.profile_version, h.occurred_at
  from public.nov_talent_student_profile_audit_v1 h
  where h.application_id = v_application_id
  order by h.occurred_at desc, h.audit_id desc
  limit 20;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'application_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_student_profile_audit_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_student_profile_audit_v1(uuid, text)
  to service_role;

commit;
