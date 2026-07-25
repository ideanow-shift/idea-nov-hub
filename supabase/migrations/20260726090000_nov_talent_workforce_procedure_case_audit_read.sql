begin;

create or replace function public.get_nov_talent_workforce_procedure_case_audit_v1(
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
  v_entries jsonb;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  if p_case_id is null then
    raise exception using errcode = '22023', message = 'invalid_procedure_case_audit';
  end if;

  perform 1
  from public.nov_talent_workforce_procedure_cases_v1 c
  where c.case_id = p_case_id;
  if not found then
    raise exception using errcode = '55000', message = 'procedure_case_not_exact1';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'action', h.action,
    'changed_fields', h.changed_fields,
    'case_version', h.case_version,
    'occurred_at', h.occurred_at
  ) order by h.occurred_at desc, h.audit_id desc), '[]'::jsonb)
  into v_entries
  from (
    select *
    from public.nov_talent_workforce_procedure_case_audit_v1
    where case_id = p_case_id
    order by occurred_at desc, audit_id desc
    limit 20
  ) h;

  return jsonb_build_object('entries', v_entries);
end
$function$;

revoke all on function public.get_nov_talent_workforce_procedure_case_audit_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_workforce_procedure_case_audit_v1(uuid, uuid)
  to service_role;

commit;
